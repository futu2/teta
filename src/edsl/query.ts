import type { AST } from "node-sql-parser";
import {
  INTERNAL_SCOPE_PREFIX,
  OUTER_TABLE_ALIAS,
  type ColumnType,
  type CteSpec,
  type ExprNode,
  type SqlIdentifier,
  type InferSchema,
  type JoinTypeInput,
  type OrderItem,
  type QueryIR,
  type QuerySpec,
  type Stage,
  type Source,
  type JoinSource,
  type TableSourceInput,
} from "./core/types";
import type {
  Dialect,
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
  isAliasedSelectValue,
  isProjectionItem,
  toExprNode,
  unwrapGroupExpr,
} from "./expr";
import type {
  ColumnRefs,
  ExprRefs,
  ProjectionList,
  ProjectionListResult,
  SelectResult,
  SelectSelection,
  SelectShape,
  ValidatedProjectionList,
  SelectValue,
} from "./expr";
import {
  renderPipelineAst,
  createDeferredRecursiveCte,
  resolveDialect,
} from "./sql";

import {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  columnNamesToIdentifierMap,
  identifierName,
  mergeWiths,
  selectItemsToIdentifierMap,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
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
type NullableColumns<TColumns extends Record<string, any>> = {
  [K in keyof TColumns]: TColumns[K] | null;
};

type LeftJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = TLeft & NullableColumns<TRight>;

type RightJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = NullableColumns<TLeft> & TRight;

type FullJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = NullableColumns<TLeft> & NullableColumns<TRight>;

type InnerJoinType = "inner" | "INNER";
type LeftJoinType = "left" | "LEFT";
type RightJoinType = "right" | "RIGHT";
type FullJoinType = "full" | "FULL";

let scopeCounter = 0;

function freshScopeId(): string {
  return `${INTERNAL_SCOPE_PREFIX}${scopeCounter++}`;
}

function assertProjectionAliasMatchesKey(key: string, alias: SqlIdentifier): SqlIdentifier {
  if (identifierName(alias) !== key) {
    throw new Error(`Projected alias ${identifierName(alias)} must match object key ${key}`);
  }
  return alias;
}

function resolveProjectionExpr(key: string, value: SelectValue): {
  expr: ExprNode<any>;
  as: SqlIdentifier | null;
} {
  const explicitAlias = isAliasedSelectValue(value)
    ? assertProjectionAliasMatchesKey(
        key,
        normalizeIdentifier(value.as, "select alias")
      )
    : null;
  const expr = toExprNode(isAliasedSelectValue(value) ? value.value : value);
  return {
    expr,
    as: explicitAlias ?? (shouldAlias(expr, key) ? normalizeIdentifier(key, "select alias") : null),
  };
}

type ResolvedProjection = {
  keys: string[];
  items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }>;
};

type ResolvedAggregateProjection = ResolvedProjection & {
  groupBy: ExprNode<any>[];
};

function assertUniqueProjectionKeys(keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`Duplicate projected column name: ${key}`);
    }
    seen.add(key);
  }
}

function projectionEntries(selection: SelectSelection): Array<{ key: string; value: SelectValue }> {
  if (!Array.isArray(selection)) {
    const shape = selection as Record<string, SelectValue>;
    return Object.keys(shape).map((key) => ({ key, value: shape[key]! }));
  }

  const entries = selection.map((item) => {
    if (!isProjectionItem(item)) {
      throw new Error("Projection lists must be built with project() or projects(); wrap preset()/selectAll()/prefix()/namespace()/remap() with projects()");
    }
    return { key: item.key, value: item.value };
  });
  assertUniqueProjectionKeys(entries.map((item) => item.key));
  return entries;
}

function resolveSelectProjection(selection: SelectSelection): ResolvedProjection {
  const entries = projectionEntries(selection);
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const resolved = resolveProjectionExpr(item.key, item.value);
      if (containsGroup(resolved.expr)) {
        throw new Error("group() is only valid inside aggregate()");
      }
      return resolved;
    }),
  };
}

function resolveAggregateProjection(selection: SelectSelection): ResolvedAggregateProjection {
  const entries = projectionEntries(selection);
  const groupBy: ExprNode<any>[] = [];
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const explicitAlias = isAliasedSelectValue(item.value)
        ? assertProjectionAliasMatchesKey(
            item.key,
            normalizeIdentifier(item.value.as, "select alias")
          )
        : null;
      const expr = toExprNode(isAliasedSelectValue(item.value) ? item.value.value : item.value);
      const unwrapped = unwrapGroupExpr(expr, groupBy, false);
      return {
        expr: unwrapped,
        as: explicitAlias ?? (shouldAlias(unwrapped, item.key)
          ? normalizeIdentifier(item.key, "select alias")
          : null),
      };
    }),
    groupBy,
  };
}
/** Composable query builder with typed columns and SQL rendering. */
export class Query<TColumns extends Record<string, any>> {
  constructor(
    readonly source: Source,
    readonly stages: Stage[],
    readonly columns: ColumnRefs<TColumns>,
    readonly columnNames: readonly string[] | null,
    readonly sourceScopeId: string,
    readonly scopeId: string,
    readonly withs: CteSpec[] = [],
    readonly columnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null = columnNamesToIdentifierMap(columnNames)
  ) {}

  select<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>>;
  select<const Sel extends ProjectionList>(
    selector: (cols: ColumnRefs<TColumns>) => ValidatedProjectionList<Sel>
  ): Query<ProjectionListResult<Sel>>;
  select(
    selector: (cols: ColumnRefs<TColumns>) => SelectSelection
  ): Query<Record<string, any>> {
    const selection = selector(this.columns);
    const { keys, items } = resolveSelectProjection(selection);
    const outputScopeId = freshScopeId();
    const stage: Stage = {
      kind: "select",
      items,
      keys,
      groupBy: null,
      outputScopeId,
    };
    const nextColumns = createColumnRefs<Record<string, unknown>>(outputScopeId, keys);
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      keys,
      this.sourceScopeId,
      outputScopeId,
      this.withs,
      selectItemsToIdentifierMap(items)
    );
  }

  aggregate<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>>;
  aggregate<const Sel extends ProjectionList>(
    selector: (cols: ColumnRefs<TColumns>) => ValidatedProjectionList<Sel>
  ): Query<ProjectionListResult<Sel>>;
  aggregate(
    selector: (cols: ColumnRefs<TColumns>) => SelectSelection
  ): Query<Record<string, any>> {
    const selection = selector(this.columns);
    const resolved = resolveAggregateProjection(selection);
    const finalGroupBy = dedupeExprs(resolved.groupBy);
    const outputScopeId = freshScopeId();
    const stage: Stage = {
      kind: "select",
      items: resolved.items,
      keys: resolved.keys,
      groupBy: finalGroupBy.length ? finalGroupBy : null,
      outputScopeId,
    };
    const nextColumns = createColumnRefs<Record<string, unknown>>(outputScopeId, resolved.keys);
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      resolved.keys,
      this.sourceScopeId,
      outputScopeId,
      this.withs,
      selectItemsToIdentifierMap(resolved.items)
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
        this.sourceScopeId,
        this.scopeId,
        this.withs,
        this.columnIdentifiers
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
        this.sourceScopeId,
        this.scopeId,
        this.withs,
        this.columnIdentifiers
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
        this.sourceScopeId,
        this.scopeId,
        this.withs,
        this.columnIdentifiers
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
        this.sourceScopeId,
        this.scopeId,
        this.withs,
        this.columnIdentifiers
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
    joinType: InnerJoinType
  ): Query<TColumns & TRight>;
  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: LeftJoinType
  ): Query<LeftJoinColumns<TColumns, TRight>>;
  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: RightJoinType
  ): Query<RightJoinColumns<TColumns, TRight>>;
  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: FullJoinType
  ): Query<FullJoinColumns<TColumns, TRight>>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: InnerJoinType,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: LeftJoinType,
    mergeColumns: JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
  ): Query<TMerged>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: RightJoinType,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
  ): Query<TMerged>;
  join<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: FullJoinType,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged>
  ): Query<TMerged>;
  join<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = TColumns & TRight
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinTypeOrMerge:
      | JoinTypeInput
      | JoinColumnMerger<TColumns, TRight, TMerged>
      | JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged> = "inner",
    mergeColumns?:
      | JoinColumnMerger<TColumns, TRight, TMerged>
      | JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged>
  ): Query<TMerged> {
    const joinType = typeof joinTypeOrMerge === "function" ? "inner" : joinTypeOrMerge;
    const normalizedJoinType = normalizeJoinType(joinType);
    const mergeResolver =
      (typeof joinTypeOrMerge === "function"
        ? joinTypeOrMerge
        : (mergeColumns ?? defaultJoinColumnMerger)) as unknown as JoinColumnMerger<
        Record<string, any>,
        Record<string, any>,
        TMerged
      >;
    const alias = autoAlias(right.source.table, this.stages);
    const rightKeys = right.columnNames ? [...right.columnNames] : null;
    const rightColumns = createColumnRefs<TRight>(right.scopeId, rightKeys);
    const predicate = on(this.columns, rightColumns).node;
    const mergeLeftColumns =
      normalizedJoinType === "RIGHT" || normalizedJoinType === "FULL"
        ? (this.columns as unknown as ColumnRefs<NullableColumns<TColumns>>)
        : this.columns;
    const mergeRightColumns =
      normalizedJoinType === "LEFT" || normalizedJoinType === "FULL"
        ? (rightColumns as unknown as ColumnRefs<NullableColumns<TRight>>)
        : rightColumns;
    const mergedColumns = mergeResolver(
      mergeLeftColumns as unknown as ColumnRefs<Record<string, any>>,
      mergeRightColumns as unknown as ColumnRefs<Record<string, any>>
    );
    const nextNames = resolveMergedColumnNames(mergedColumns, this.columnNames, rightKeys);
    const outputScopeId = freshScopeId();
    const nextColumns = createColumnRefs<TMerged>(outputScopeId, nextNames);
    const joinSource: JoinSource =
      right.stages.length === 0
        ? { kind: "table", db: right.source.db, table: right.source.table, schema: right.source.schema }
        : {
            kind: "subquery",
            query: {
              source: right.source,
              stages: right.stages,
              columnNames: right.columnNames,
              columnIdentifiers: right.columnIdentifiers,
              scopeId: right.sourceScopeId,
            },
            inheritedBindings: null,
          };
    const stage: Stage = {
      kind: "join",
      joinType: normalizedJoinType,
      lateral: false,
      source: joinSource,
      as: alias,
      on: predicate,
      selectAll: selectAllItems(mergedColumns, nextNames),
      rightScopeId: right.scopeId,
      outputScopeId,
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      nextNames,
      this.sourceScopeId,
      outputScopeId,
      mergeWiths(this.withs, right.withs),
      selectItemsToIdentifierMap(stage.selectAll)
    );
  }

  innerJoin<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = TColumns & TRight
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged> = defaultJoinColumnMerger as JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged> {
    return this.join(right, on, "inner", mergeColumns);
  }

  leftJoin<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = LeftJoinColumns<TColumns, TRight>
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged> = defaultJoinColumnMerger as unknown as JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
  ): Query<TMerged> {
    return this.join(right, on, "left", mergeColumns);
  }

  rightJoin<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = RightJoinColumns<TColumns, TRight>
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged> = defaultJoinColumnMerger as unknown as JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
  ): Query<TMerged> {
    return this.join(right, on, "right", mergeColumns);
  }

  fullJoin<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = FullJoinColumns<TColumns, TRight>
  >(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged> = defaultJoinColumnMerger as unknown as JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged>
  ): Query<TMerged> {
    return this.join(right, on, "full", mergeColumns);
  }

  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: InnerJoinType
  ): Query<TColumns & TRight>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: LeftJoinType
  ): Query<LeftJoinColumns<TColumns, TRight>>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: RightJoinType
  ): Query<RightJoinColumns<TColumns, TRight>>;
  lateralJoin<TRight extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: FullJoinType
  ): Query<FullJoinColumns<TColumns, TRight>>;
  lateralJoin<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  lateralJoin<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: InnerJoinType,
    mergeColumns: JoinColumnMerger<TColumns, TRight, TMerged>
  ): Query<TMerged>;
  lateralJoin<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: LeftJoinType,
    mergeColumns: JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
  ): Query<TMerged>;
  lateralJoin<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: RightJoinType,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
  ): Query<TMerged>;
  lateralJoin<TRight extends Record<string, any>, TMerged extends Record<string, any>>(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: FullJoinType,
    mergeColumns: JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged>
  ): Query<TMerged>;
  lateralJoin<
    TRight extends Record<string, any>,
    TMerged extends Record<string, any> = TColumns & TRight
  >(
    right:
      | Query<TRight>
      | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinTypeOrMerge:
      | JoinTypeInput
      | JoinColumnMerger<TColumns, TRight, TMerged>
      | JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged> = "inner",
    mergeColumns?:
      | JoinColumnMerger<TColumns, TRight, TMerged>
      | JoinColumnMerger<TColumns, NullableColumns<TRight>, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, TRight, TMerged>
      | JoinColumnMerger<NullableColumns<TColumns>, NullableColumns<TRight>, TMerged>
  ): Query<TMerged> {
    const joinType = typeof joinTypeOrMerge === "function" ? "inner" : joinTypeOrMerge;
    const normalizedJoinType = normalizeJoinType(joinType);
    const mergeResolver =
      (typeof joinTypeOrMerge === "function"
        ? joinTypeOrMerge
        : (mergeColumns ?? defaultJoinColumnMerger)) as unknown as JoinColumnMerger<
        Record<string, any>,
        Record<string, any>,
        TMerged
      >;
    const outerColumns = qualifyOuterColumns(this.columns);
    const rightQuery = typeof right === "function" ? right(outerColumns) : right;
    const alias = autoAlias(rightQuery.source.table, this.stages);
    const rightKeys = rightQuery.columnNames ? [...rightQuery.columnNames] : null;
    const rightColumns = createColumnRefs<TRight>(rightQuery.scopeId, rightKeys);
    const predicate = on(this.columns, rightColumns).node;
    const mergeLeftColumns =
      normalizedJoinType === "RIGHT" || normalizedJoinType === "FULL"
        ? (this.columns as unknown as ColumnRefs<NullableColumns<TColumns>>)
        : this.columns;
    const mergeRightColumns =
      normalizedJoinType === "LEFT" || normalizedJoinType === "FULL"
        ? (rightColumns as unknown as ColumnRefs<NullableColumns<TRight>>)
        : rightColumns;
    const mergedColumns = mergeResolver(
      mergeLeftColumns as unknown as ColumnRefs<Record<string, any>>,
      mergeRightColumns as unknown as ColumnRefs<Record<string, any>>
    );
    const nextNames = resolveMergedColumnNames(mergedColumns, this.columnNames, rightKeys);
    const outputScopeId = freshScopeId();
    const nextColumns = createColumnRefs<TMerged>(outputScopeId, nextNames);
    const joinSource: JoinSource = {
      kind: "subquery",
      query: {
        source: rightQuery.source,
        stages: rightQuery.stages,
        columnNames: rightQuery.columnNames,
        columnIdentifiers: rightQuery.columnIdentifiers,
        scopeId: rightQuery.sourceScopeId,
      },
      inheritedBindings: null,
    };
    const stage: Stage = {
      kind: "join",
      joinType: normalizedJoinType,
      lateral: true,
      source: joinSource,
      as: alias,
      on: predicate,
      selectAll: selectAllItems(mergedColumns, nextNames),
      rightScopeId: rightQuery.scopeId,
      outputScopeId,
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      nextNames,
      this.sourceScopeId,
      outputScopeId,
      mergeWiths(this.withs, rightQuery.withs),
      selectItemsToIdentifierMap(stage.selectAll)
    );
  }
  toIR(): QueryIR {
    return { source: this.source, stages: this.stages, scopeId: this.sourceScopeId };
  }

  toAst(options?: { dialect?: Dialect }): AST {
    return renderPipelineAst(
      this.source,
      this.stages,
      this.columnNames,
      this.sourceScopeId,
      {
        baseCtes: this.withs,
        dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
      }
    );
  }

  toSql(renderer: SqlRenderer<any, SqlResult>): string {
    return renderer.toSql(this);
  }

  toSqlResult<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSqlResult(this);
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
      columnIdentifiers: right.columnIdentifiers,
      scopeId: right.sourceScopeId,
    };
    const outputScopeId = freshScopeId();
    const stage: Stage = {
      kind: "union",
      op,
      right: rightSpec,
      selectAll: selectAllItems(this.columns, this.columnNames),
      outputScopeId,
    };
    const nextColumns = createColumnRefs<TColumns>(outputScopeId, this.columnNames);
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      this.columnNames,
      this.sourceScopeId,
      outputScopeId,
      mergeWiths(this.withs, right.withs),
      selectItemsToIdentifierMap(stage.selectAll)
    );
  }
}

/** Column type helpers for table schemas. */
export function ident<const Name extends string>(name: Name): SqlIdentifier<Name> {
  return normalizeIdentifier({ name, quoted: true }, "identifier");
}

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
  name: TableSourceInput,
  schema: S
): Query<InferSchema<S>> {
  const columnNames = Object.keys(schema);
  const source = normalizeTableSource(name);
  const scopeId = freshScopeId();
  const columns = createColumnRefs<InferSchema<S>>(scopeId, columnNames);
  return new Query(
    source,
    [],
    columns,
    columnNames,
    scopeId,
    scopeId,
    [],
    columnNamesToIdentifierMap(columnNames)
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
  const selfScopeId = freshScopeId();
  const self = new Query<TColumns>(
    { db: null, table: normalizeIdentifier(name, "table"), schema: null, as: null },
    [],
    createColumnRefs<TColumns>(selfScopeId, selfColumnNames),
    selfColumnNames,
    selfScopeId,
    selfScopeId,
    [],
    base.columnIdentifiers
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
      columnIdentifiers: base.columnIdentifiers,
      scopeId: base.sourceScopeId,
    },
    {
      source: stepQuery.source,
      stages: stepQuery.stages,
      columnNames: stepQuery.columnNames,
      columnIdentifiers: stepQuery.columnIdentifiers,
      scopeId: stepQuery.sourceScopeId,
    }
  );
  const resultScopeId = freshScopeId();
  const columns = createColumnRefs<TColumns>(resultScopeId, selfColumnNames);
  return new Query(
    { db: null, table: normalizeIdentifier(name, "table"), schema: null, as: null },
    [],
    columns,
    selfColumnNames,
    resultScopeId,
    resultScopeId,
    [recursiveCte],
    base.columnIdentifiers
  );
}
