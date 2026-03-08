import type { AST } from "node-sql-parser";
import {
  OUTER_TABLE_ALIAS,
  type ColumnType,
  type CteSpec,
  type ExprNode,
  type InferSchema,
  type JoinTypeInput,
  type OrderItem,
  type QueryIR,
  type QuerySpec,
  type Stage,
  type Source,
  type JoinSource,
} from "./core/types";
import type {
  SqlRenderer,
  SqlFloat,
  SqlInt,
  SqlDate,
  SqlResult,
  SqlTimestamp,
} from "./sql/types";
import {
  ExprRef,
  containsGroup,
  createColumnRefs,
  dedupeExprs,
  mergeColumnNames,
  selectAllItems,
  shouldAlias,
  toExprNode,
  unwrapGroupExpr,
} from "./expr";
import type { ColumnRefs, ExprRefs, SelectResult, SelectShape } from "./expr";
import {
  renderPipelineAst,
  createDeferredRecursiveCte,
} from "./sql";

import {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  mergeWiths,
  normalizeJoinType,
  parseTableName,
  qualifyOuterColumns,
} from "./query/utils";

type JoinColumnMerger<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TMerged extends Record<string, any> = TLeft & TRight
> = (
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRefs<TMerged>;

function defaultJoinColumnMerger<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
>(u: ColumnRefs<TLeft>, o: ColumnRefs<TRight>): ExprRefs<TLeft & TRight> {
  return { ...u, ...o } as ExprRefs<TLeft & TRight>;
}

function resolveMergedColumnNames<TColumns extends Record<string, any>>(
  columns: ExprRefs<TColumns>,
  left: readonly string[] | null,
  right: readonly string[] | null
): readonly string[] | null {
  const merged = Object.keys(columns);
  if (merged.length) return merged;
  return mergeColumnNames(left, right);
}

/** Composable query builder with typed columns and SQL rendering. */
export class Query<TColumns extends Record<string, any>> {
  constructor(
    readonly source: Source,
    readonly stages: Stage[],
    readonly columns: ColumnRefs<TColumns>,
    readonly columnNames: readonly string[] | null,
    readonly withs: CteSpec[] = []
  ) {}

  select<Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    const shape = selector(this.columns);
    const keys = Object.keys(shape);
    const items = keys.map((key) => {
      const value = shape[key];
      const expr = toExprNode(value);
      if (containsGroup(expr)) {
        throw new Error("group() is only valid inside aggregate()");
      }
      const as = shouldAlias(expr, key) ? key : null;
      return { expr, as };
    });
    const stage: Stage = {
      kind: "select",
      items,
      keys,
      groupBy: null,
    };
    const nextColumns = createColumnRefs<SelectResult<Sel>>(null, keys);
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      keys,
      this.withs
    );
  }

  aggregate<Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    const shape = selector(this.columns);
    const keys = Object.keys(shape);
    const groupBy: ExprNode<any>[] = [];
    const items = keys.map((key) => {
      const value = shape[key];
      const expr = toExprNode(value);
      const unwrapped = unwrapGroupExpr(expr, groupBy, false);
      const as = shouldAlias(unwrapped, key) ? key : null;
      return { expr: unwrapped, as };
    });

    const finalGroupBy = dedupeExprs(groupBy);
    const stage: Stage = {
      kind: "select",
      items,
      keys,
      groupBy: finalGroupBy.length ? finalGroupBy : null,
    };
    const nextColumns = createColumnRefs<SelectResult<Sel>>(null, keys);
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      keys,
      this.withs
    );
  }

  filter(
    predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
  ): Query<TColumns> {
    const next = predicate(this.columns).node;
    const lastStage = this.stages[this.stages.length - 1];
    if (lastStage?.kind === "filter") {
      const merged: Stage = {
        kind: "filter",
        predicate: {
          kind: "binary",
          op: "AND",
          left: lastStage.predicate,
          right: next,
        },
        selectAll: lastStage.selectAll,
      };
      return new Query(
        this.source,
        [...this.stages.slice(0, -1), merged],
        this.columns,
        this.columnNames,
        this.withs
      );
    }
    const stage: Stage = {
      kind: "filter",
      predicate: next,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
  }

  orderBy(
    selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
  ): Query<TColumns> {
    const next = selector(this.columns);
    const items = Array.isArray(next) ? next : [next];
    const stage: Stage = {
      kind: "orderBy",
      items,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
  }

  limit(count: number): Query<TColumns> {
    const stage: Stage = {
      kind: "limit",
      count,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
  }

  unionAll(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union all");
  }

  union(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union");
  }

  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight>;
  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: JoinTypeInput
  ): Query<TColumns & TRight>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: JoinTypeInput,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  join<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = TColumns & TRight
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinTypeOrMerge: JoinTypeInput | JoinColumnMerger<TColumns, TRight, TMerged> = "inner",
    mergeColumns?: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged> {
    const joinType = typeof joinTypeOrMerge === "function" ? "inner" : joinTypeOrMerge;
    const mergeResolver =
      typeof joinTypeOrMerge === "function"
        ? joinTypeOrMerge
        : (mergeColumns ??
          (defaultJoinColumnMerger as JoinColumnMerger<TColumns, TRight, TMerged>));
    const alias = autoAlias(right.source.table, this.stages);
    const rightKeys = right.columnNames ? [...right.columnNames] : null;
    const rightColumns = createColumnRefs<TRight>(alias, rightKeys);
    const predicate = on(this.columns, rightColumns).node;
    const mergedColumns = mergeResolver(this.columns, rightColumns);
    const nextNames = resolveMergedColumnNames(mergedColumns, this.columnNames, rightKeys);
    const nextColumns = createColumnRefs<TMerged>(null, nextNames);
    const joinSource: JoinSource =
      right.stages.length === 0
        ? { kind: "table", table: right.source.table, schema: right.source.schema }
        : {
            kind: "subquery",
            query: {
              source: right.source,
              stages: right.stages,
              columnNames: right.columnNames,
            },
            keepTables: null,
          };
    const stage: Stage = {
      kind: "join",
      joinType: normalizeJoinType(joinType),
      lateral: false,
      source: joinSource,
      as: alias,
      on: predicate,
      selectAll: selectAllItems(mergedColumns, nextNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      nextNames,
      mergeWiths(this.withs, right.withs)
    );
  }

  innerJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight> = defaultJoinColumnMerger
  ): Query<TColumns & TRight> {
    return this.join(right, on, "inner", mergeColumns);
  }

  leftJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight> = defaultJoinColumnMerger
  ): Query<TColumns & TRight> {
    return this.join(right, on, "left", mergeColumns);
  }

  rightJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight> = defaultJoinColumnMerger
  ): Query<TColumns & TRight> {
    return this.join(right, on, "right", mergeColumns);
  }

  fullJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight> = defaultJoinColumnMerger
  ): Query<TColumns & TRight> {
    return this.join(right, on, "full", mergeColumns);
  }

  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight>
  ): Query<TColumns & TRight>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType?: JoinTypeInput,
    mergeColumns?: JoinColumnMerger<TColumns, TRight>
  ): Query<TColumns & TRight>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinTypeOrMerge: JoinTypeInput | JoinColumnMerger<TColumns, TRight> = "inner",
    mergeColumns: JoinColumnMerger<TColumns, TRight> = defaultJoinColumnMerger
  ): Query<TColumns & TRight> {
    const joinType = typeof joinTypeOrMerge === "function" ? "inner" : joinTypeOrMerge;
    const mergeResolver =
      typeof joinTypeOrMerge === "function" ? joinTypeOrMerge : mergeColumns;
    const outerColumns = qualifyOuterColumns(this.columns);
    const rightQuery = typeof right === "function" ? right(outerColumns) : right;
    const alias = autoAlias(rightQuery.source.table, this.stages);
    const rightKeys = rightQuery.columnNames ? [...rightQuery.columnNames] : null;
    const rightColumns = createColumnRefs<TRight>(alias, rightKeys);
    const predicate = on(this.columns, rightColumns).node;
    const mergedColumns = mergeResolver(this.columns, rightColumns);
    const nextNames = resolveMergedColumnNames(mergedColumns, this.columnNames, rightKeys);
    const nextColumns = createColumnRefs<TColumns & TRight>(null, nextNames);
    const joinSource: JoinSource = {
      kind: "subquery",
      query: {
        source: rightQuery.source,
        stages: rightQuery.stages,
        columnNames: rightQuery.columnNames,
      },
      keepTables: [OUTER_TABLE_ALIAS],
    };
    const stage: Stage = {
      kind: "join",
      joinType: normalizeJoinType(joinType),
      lateral: true,
      source: joinSource,
      as: alias,
      on: predicate,
      selectAll: selectAllItems(mergedColumns, nextNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      nextNames,
      mergeWiths(this.withs, rightQuery.withs)
    );
  }

  toIR(): QueryIR {
    return { source: this.source, stages: this.stages };
  }

  toAst(): AST {
    return renderPipelineAst(
      this.source,
      this.stages,
      this.columnNames,
      { baseCtes: this.withs }
    );
  }

  toSql<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSql(this);
  }

  private unionInternal(right: Query<TColumns>, op: "union" | "union all"): Query<TColumns> {
    const leftNames = this.columnNames;
    const rightNames = right.columnNames;
    if (!leftNames || !rightNames) {
      throw new Error("union requires both queries to have explicit column lists");
    }
    assertUnionCompatible(leftNames, rightNames);
    const rightSpec: QuerySpec = {
      source: right.source,
      stages: right.stages,
      columnNames: right.columnNames,
    };
    const stage: Stage = {
      kind: "union",
      op,
      right: rightSpec,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      mergeWiths(this.withs, right.withs)
    );
  }
}

/** Column type helpers for table schemas. */
export const t = {
  string: () => ({ kind: "column_type" } as ColumnType<string>),
  int: () => ({ kind: "column_type" } as ColumnType<SqlInt>),
  float: () => ({ kind: "column_type" } as ColumnType<SqlFloat>),
  boolean: () => ({ kind: "column_type" } as ColumnType<boolean>),
  date: () => ({ kind: "column_type" } as ColumnType<SqlDate>),
  timestamp: () => ({ kind: "column_type" } as ColumnType<SqlTimestamp>),
};

/** Define a table with a schema and return a typed query builder. */
export function table<S extends Record<string, ColumnType<any>>>(
  name: string,
  schema: S
): Query<InferSchema<S>> {
  const columnNames = Object.keys(schema);
  const { table, schema: schemaName } = parseTableName(name);
  const columns = createColumnRefs<InferSchema<S>>(null, columnNames);
  return new Query(
    { table, schema: schemaName, as: null },
    [],
    columns,
    columnNames,
    []
  );
}

let loopCounter = 0;

/** Build a recursive CTE query from a base query and recursive step. */
export function loop<TColumns extends Record<string, any>>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  if (!base.columnNames) {
    throw new Error("loop base query must have explicit columns");
  }
  const name = `loop_${loopCounter++}`;
  const selfColumnNames = [...base.columnNames];
  const self = new Query<TColumns>(
    { table: name, schema: null, as: null },
    [],
    createColumnRefs<TColumns>(null, selfColumnNames),
    selfColumnNames,
    []
  );
  const stepQuery = step(self);
  assertLoopColumns(base.columnNames, stepQuery.columnNames);
  if (base.withs.length || stepQuery.withs.length) {
    throw new Error("loop does not allow nested CTEs in base or step queries");
  }
  const recursiveCte = createDeferredRecursiveCte(
    name,
    selfColumnNames,
    {
      source: base.source,
      stages: base.stages,
      columnNames: base.columnNames,
    },
    {
      source: stepQuery.source,
      stages: stepQuery.stages,
      columnNames: stepQuery.columnNames,
    }
  );
  const columns = createColumnRefs<TColumns>(null, selfColumnNames);
  return new Query(
    { table: name, schema: null, as: null },
    [],
    columns,
    selfColumnNames,
    [recursiveCte]
  );
}
