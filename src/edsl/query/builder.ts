import type { AST } from "node-sql-parser";
import type {
  CteSpec,
  JoinTypeInput,
  OrderItem,
  SqlIdentifier,
} from "../core/types";
import type {
  Dialect,
  SqlRenderer,
  SqlResult,
} from "../sql/types";
import { ExprRef } from "../expr";
import { createColumnRefs } from "../expr";
import type {
  ColumnRefs,
  SelectResult,
  SelectShape,
} from "../expr";
import {
  createDeferredRecursiveCte,
  renderPipelineAst,
  resolveDialect,
} from "../sql";
import { freshInternalCteName, freshScopeId } from "./planner";
import { toQuerySpec } from "./state";
import { assertLoopColumns, normalizeIdentifier, qualifyOuterColumns } from "./utils";
import type {
  CanonicalJoinType,
  JoinColumnMerger,
  JoinColumnsForType,
  JoinOptions,
} from "./join";
import type {
  QueryDeriveInit,
  QueryInit,
  QueryState,
} from "./state";
import {
  resolveDerivedQueryInit,
  resolveQueryInitDefaults,
} from "./state";
import {
  resolveAggregateQuery,
  resolveFilterQuery,
  resolveJoinQuery,
  resolveLimitQuery,
  resolveOrderQuery,
  resolveSelectQuery,
  resolveUnionQuery,
} from "./mutations";

type QueryColumns = Record<string, any>;

export type QueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
> = (query: Query<TInputColumns>) => Query<TOutputColumns>;

export type QueryIR<TColumns extends QueryColumns> = {
  source: Query<TColumns>["source"];
  stages: Query<TColumns>["stages"];
  scopeId: Query<TColumns>["sourceScopeId"];
};

/** Composable query builder with typed columns and SQL rendering. */
export class Query<TColumns extends QueryColumns> implements QueryState<TColumns> {
  constructor(
    readonly source: QueryState<TColumns>["source"],
    readonly stages: QueryState<TColumns>["stages"],
    readonly columns: QueryState<TColumns>["columns"],
    readonly columnNames: QueryState<TColumns>["columnNames"],
    readonly sourceScopeId: QueryState<TColumns>["sourceScopeId"],
    readonly scopeId: QueryState<TColumns>["scopeId"],
    readonly withs: CteSpec[] = [],
    readonly columnIdentifiers: Readonly<Record<string, SqlIdentifier>>
  ) {}

  select<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    return buildSelect(this, selector);
  }

  aggregate<const Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    return buildAggregate(this, selector);
  }

  filter(
    predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
  ): Query<TColumns> {
    return buildFilter(this, predicate);
  }

  orderBy(
    selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
  ): Query<TColumns> {
    return buildOrderBy(this, selector);
  }

  limit(count: number): Query<TColumns> {
    return buildLimit(this, count);
  }

  unionAll(right: Query<TColumns>): Query<TColumns> {
    return buildUnion(this, right, "union all");
  }

  union(right: Query<TColumns>): Query<TColumns> {
    return buildUnion(this, right, "union");
  }

  loop(
    step: (self: Query<TColumns>) => Query<TColumns>
  ): Query<TColumns> {
    return buildLoop(this, step);
  }

  join<
    TRight extends Record<string, any>,
    TType extends JoinTypeInput | undefined = undefined,
    TMerged extends Record<string, any> = JoinColumnsForType<
      TColumns,
      TRight,
      CanonicalJoinType<TType>
    >,
  >(
    right: Query<TRight> | ((outer: ColumnRefs<TColumns>) => Query<TRight>),
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    options: JoinOptions<TColumns, TRight, TType, TMerged> = {}
  ): Query<TMerged> {
    return buildJoin(this, right, on, options);
  }

  toIR(): QueryIR<TColumns> {
    return toIR(this);
  }

  toAst(options?: { dialect?: Dialect }): AST {
    return toAst(this, options);
  }

  toSql(renderer: SqlRenderer<any, SqlResult>): string {
    return toSql(this, renderer);
  }

  toSqlResult<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return toSqlResult(this, renderer);
  }
}

export function createQuery<TColumns extends QueryColumns>(
  init: QueryInit<TColumns>
): Query<TColumns> {
  const resolved = resolveQueryInitDefaults(init);
  return new Query(
    resolved.source,
    resolved.stages,
    resolved.columns,
    resolved.columnNames,
    resolved.sourceScopeId,
    resolved.scopeId,
    resolved.withs,
    resolved.columnIdentifiers
  );
}

function deriveQuery<
  TCurrentColumns extends QueryColumns,
  TNextColumns extends QueryColumns,
>(
  query: Query<TCurrentColumns>,
  init: QueryDeriveInit<TNextColumns>
): Query<TNextColumns> {
  return createQuery(resolveDerivedQueryInit(query, init));
}

function buildJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TMerged extends QueryColumns = JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  options: JoinOptions<TLeft, TRight, TType, TMerged> = {}
): Query<TMerged> {
  const outerColumns = qualifyOuterColumns(left.columns);
  const lateral = typeof right === "function" || options.lateral === true;
  const rightQuery = typeof right === "function" ? right(outerColumns) : right;
  return deriveQuery(
    left,
    resolveJoinQuery(
      left,
      rightQuery,
      on,
      lateral,
      options.type ?? "inner",
      options.merge as JoinColumnMerger<QueryColumns, QueryColumns, TMerged> | undefined
    )
  );
}

function buildSelect<
  TColumns extends QueryColumns,
  TSelection extends SelectShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<SelectResult<TSelection>> {
  return deriveQuery(query, resolveSelectQuery(query, selector(query.columns)));
}

function buildAggregate<
  TColumns extends QueryColumns,
  TSelection extends SelectShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<SelectResult<TSelection>> {
  return deriveQuery(query, resolveAggregateQuery(query, selector(query.columns)));
}

function buildFilter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): Query<TColumns> {
  return deriveQuery(query, resolveFilterQuery(query, predicate(query.columns).node));
}

function buildOrderBy<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): Query<TColumns> {
  const next = selector(query.columns);
  return deriveQuery(query, resolveOrderQuery(query, Array.isArray(next) ? next : [next]));
}

function buildLimit<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return deriveQuery(query, resolveLimitQuery(query, count));
}

function buildUnion<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>,
  kind: "union" | "union all"
): Query<TColumns> {
  return deriveQuery(left, resolveUnionQuery(left, right, kind));
}

function buildLoop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  const name = freshInternalCteName("loop");
  const selfColumnNames = [...base.columnNames];
  const loopSource = {
    db: null,
    table: normalizeIdentifier(name, "table"),
    schema: null,
    as: null,
  };
  const selfScopeId = freshScopeId();
  const self = createQuery<TColumns>({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(selfScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: selfScopeId,
    scopeId: selfScopeId,
    columnIdentifiers: base.columnIdentifiers,
  });
  const stepQuery = step(self);
  assertLoopColumns(base.columnNames, stepQuery.columnNames);
  if (base.withs.length || stepQuery.withs.length) {
    throw new Error("loop does not allow nested CTEs in base or step queries");
  }

  const recursiveCte = createDeferredRecursiveCte(
    name,
    selfColumnNames,
    toQuerySpec(base),
    toQuerySpec(stepQuery)
  );
  const resultScopeId = freshScopeId();
  return createQuery({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(resultScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: resultScopeId,
    scopeId: resultScopeId,
    withs: [recursiveCte],
    columnIdentifiers: base.columnIdentifiers,
  });
}

export function select<TColumns extends QueryColumns, const Sel extends SelectShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, SelectResult<Sel>> {
  return (query) => buildSelect(query, selector);
}

export function aggregate<TColumns extends QueryColumns, const Sel extends SelectShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, SelectResult<Sel>> {
  return (query) => buildAggregate(query, selector);
}

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns> {
  return (query) => buildFilter(query, predicate);
}

export function orderBy<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns> {
  return (query) => buildOrderBy(query, selector);
}

export function limit<TColumns extends QueryColumns>(count: number): QueryStep<TColumns, TColumns> {
  return (query) => buildLimit(query, count);
}

export function unionAll<TColumns extends QueryColumns>(
  right: Query<TColumns>
): QueryStep<TColumns, TColumns> {
  return (left) => buildUnion(left, right, "union all");
}

export function union<TColumns extends QueryColumns>(
  right: Query<TColumns>
): QueryStep<TColumns, TColumns> {
  return (left) => buildUnion(left, right, "union");
}

export function loop<TColumns extends QueryColumns>(
  step: (self: Query<TColumns>) => Query<TColumns>
): QueryStep<TColumns, TColumns> {
  return (base) => buildLoop(base, step);
}

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TMerged extends QueryColumns = JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  options: JoinOptions<TLeft, TRight, TType, TMerged> = {}
): QueryStep<TLeft, TMerged> {
  return (left) => buildJoin(left, right, on, options);
}

export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns> {
  return {
    source: query.source,
    stages: query.stages,
    scopeId: query.sourceScopeId,
  };
}

export function toAst<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: { dialect?: Dialect }
): AST {
  return renderPipelineAst(
    query.source,
    query.stages,
    query.columnNames,
    query.sourceScopeId,
    {
      baseCtes: query.withs,
      dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
    }
  );
}

export function toSql<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  renderer: SqlRenderer<any, SqlResult>
): string {
  return renderer.toSql(query);
}

export function toSqlResult<TColumns extends QueryColumns, TReturn extends SqlResult>(
  query: Query<TColumns>,
  renderer: SqlRenderer<any, TReturn>
): TReturn {
  return renderer.toSqlResult(query);
}
