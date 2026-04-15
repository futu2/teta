import type { AST } from "node-sql-parser";
import { purry } from "remeda";
import type {
  CteSpec,
  JoinTypeInput,
  OrderItem,
  SqlIdentifier,
} from "../core/types.ts";
import type {
  Dialect,
  QueryDialect,
  SqlFormat,
  SqlInt,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
} from "../sql/types.ts";
import { ExprRef } from "../expr.ts";
import { createColumnRefs } from "../expr.ts";
import type {
  ColumnRefs,
  ExprRefs,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import {
  buildSqlOptions,
  createDeferredRecursiveCte,
  renderPipelineAst,
  renderSql,
  renderSqlResult,
  resolveDialect,
} from "../sql.ts";
import type { SqlCompilable } from "../sql.ts";
import { freshInternalCteName, freshScopeId } from "./planner.ts";
import { toQuerySpec } from "./state.ts";
import { assertLoopColumns, normalizeIdentifier, qualifyOuterColumns } from "./utils.ts";
import type {
  CanonicalJoinType,
  JoinColumnMerger,
  JoinColumnMergerForType,
  JoinColumnsForType,
  JoinNoMergeGuard,
  JoinOptions,
  JoinSelection,
  JoinSelectionResult,
} from "./join.ts";
import type {
  QueryDeriveInit,
  QueryInit,
  QueryState,
} from "./state.ts";
import {
  resolveDerivedQueryInit,
  resolveQueryInitDefaults,
} from "./state.ts";
import {
  resolveFoldQuery,
  resolveFilterQuery,
  resolveJoinQuery,
  resolveUnnestQuery,
  resolveTakeQuery,
  resolveSortQuery,
  resolveMapQuery,
  resolveUnionQuery,
} from "./mutations.ts";
import { userError } from "../errors.ts";

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

export type QueryExplainStage = {
  index: number;
  kind: QueryStageKind;
};

export type QueryExplainCte = {
  name: string;
  kind: CteSpec["kind"];
};

export type QueryStageKind = "map" | "fold" | "filter" | "sort" | "take" | "join" | "unnest" | "union";

type CollectionItem<TCollection> =
  NonNullable<TCollection> extends readonly (infer TItem)[] ? TItem
  : NonNullable<TCollection> extends (infer TItem)[] ? TItem
  : never;

type MaybeOuter<TValue, TOuter extends boolean | undefined> =
  TOuter extends true ? TValue | null
  : TValue;

type UnnestSelection<
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
> = {
  value: TValueName;
  ordinality?: TOrdinalityName;
};

type UnnestOptions<TOuter extends boolean | undefined = undefined> = {
  outer?: TOuter;
};

type FixedJoinOptions = {
  lateral?: boolean;
};

type UnnestGeneratedColumns<
  TItem,
  TValueName extends string,
  TOrdinalityName extends string | undefined,
  TOuter extends boolean | undefined,
> = {
  [K in TValueName]: MaybeOuter<TItem, TOuter>;
} & (TOrdinalityName extends string
  ? { [K in TOrdinalityName]: MaybeOuter<SqlInt, TOuter> }
  : {});

export type QueryExplainResult<TColumns extends QueryColumns> = {
  ir: QueryIR<TColumns>;
  ast: AST;
  sql: string;
  params: SqlResult["params"];
  columnNames: readonly string[];
  stages: QueryExplainStage[];
  ctes: QueryExplainCte[];
  dialect: QueryDialect;
  format: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
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
  TSelection extends JoinSelection = ExprRefs<JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >>,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge?: JoinColumnMergerForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>> {
  const outerColumns = qualifyOuterColumns(left.columns);
  const resolvedOptions = options ?? {};
  const lateral = typeof right === "function" || resolvedOptions.lateral === true;
  const rightQuery = typeof right === "function" ? right(outerColumns) : right;
  return deriveQuery(
    left,
    resolveJoinQuery(
      left,
      rightQuery,
      on,
      lateral,
      resolvedOptions.type ?? "inner",
      merge as JoinColumnMerger<QueryColumns, QueryColumns, TSelection> | undefined
    )
  );
}

function buildUnnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
  TGenerated extends QueryColumns = UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >,
>(
  left: Query<TLeft>,
  selector: (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options: UnnestOptions<TOuter> = {}
): Query<TLeft & TGenerated> {
  return deriveQuery(
    left,
    resolveUnnestQuery<TLeft, TGenerated>(
      left,
      selector(left.columns),
      selection,
      options
    )
  );
}

function buildMap<
  TColumns extends QueryColumns,
  TSelection extends ProjectionShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<ProjectionResult<TSelection>> {
  return deriveQuery(query, resolveMapQuery(query, selector(query.columns)));
}

function buildFold<
  TColumns extends QueryColumns,
  TSelection extends ProjectionShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<ProjectionResult<TSelection>> {
  return deriveQuery(query, resolveFoldQuery(query, selector(query.columns)));
}

function buildFilter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): Query<TColumns> {
  return deriveQuery(query, resolveFilterQuery(query, predicate(query.columns).node));
}

function buildSort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): Query<TColumns> {
  const next = selector(query.columns);
  return deriveQuery(query, resolveSortQuery(query, Array.isArray(next) ? next : [next]));
}

function buildTake<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return deriveQuery(query, resolveTakeQuery(query, count));
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
    userError("LOOP_NESTED_CTES", "loop does not allow nested CTEs in base or step queries");
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

export function map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>>;

export function map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function map(...args: unknown[]): unknown {
  return purry(_map, args);
}

function _map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>> {
  return buildMap(query, selector);
}

export function fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>>;

export function fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function fold(...args: unknown[]): unknown {
  return purry(_fold, args);
}

function _fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>> {
  return buildFold(query, selector);
}

export function filter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): Query<TColumns>;

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns>;

export function filter(...args: unknown[]): unknown {
  return purry(_filter, args);
}

function _filter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): Query<TColumns> {
  return buildFilter(query, predicate);
}

export function sort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): Query<TColumns>;

export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort(...args: unknown[]): unknown {
  return purry(_sort, args);
}

function _sort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): Query<TColumns> {
  return buildSort(query, selector);
}

export function take<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns>;

export function take<TColumns extends QueryColumns>(count: number): QueryStep<TColumns, TColumns>;

export function take(...args: unknown[]): unknown {
  return purry(_take, args);
}

function _take<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return buildTake(query, count);
}

export function unionAll<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns>;

export function unionAll<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function unionAll(...args: unknown[]): unknown {
  return purry(_unionAll, args);
}

function _unionAll<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union all");
}

export function union<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns>;

export function union<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function union(...args: unknown[]): unknown {
  return purry(_union, args);
}

function _union<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union");
}

export function loop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns>;

export function loop<TColumns extends QueryColumns>(
  step: (self: Query<TColumns>) => Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function loop(...args: unknown[]): unknown {
  return purry(_loop, args);
}

function _loop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  return buildLoop(base, step);
}

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: JoinOptions<TType>
): Query<TMerged>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  const TSelection extends JoinSelection = JoinSelection,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, CanonicalJoinType<TType>, TSelection>,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: JoinOptions<TType>
): QueryStep<TLeft, TMerged>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, CanonicalJoinType<TType>, TSelection>,
  options?: JoinOptions<TType>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function join(...args: unknown[]): unknown {
  const parsed = parseJoinInvocation(args);

  if (parsed.kind === "data_first") {
    return _join(
      parsed.left as Query<QueryColumns>,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as (left: ColumnRefs<QueryColumns>, right: ColumnRefs<QueryColumns>) => ExprRef<boolean>,
      parsed.merge as JoinColumnMerger<QueryColumns, QueryColumns, JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinTypeInput | undefined> | undefined
    );
  }

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as (left: ColumnRefs<QueryColumns>, right: ColumnRefs<QueryColumns>) => ExprRef<boolean>,
      parsed.merge as JoinColumnMerger<QueryColumns, QueryColumns, JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinTypeInput | undefined> | undefined
    );
}

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = TLeft & TRight,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): Query<TMerged>;

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>,
  options?: FixedJoinOptions
): Query<JoinSelectionResult<TSelection>>;

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = TLeft & TRight,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): QueryStep<TLeft, TMerged>;

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function innerJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "inner");
}

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "left">,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): Query<TMerged>;

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>,
  options?: FixedJoinOptions
): Query<JoinSelectionResult<TSelection>>;

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "left">,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): QueryStep<TLeft, TMerged>;

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function leftJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "left");
}

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "right">,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): Query<TMerged>;

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>,
  options?: FixedJoinOptions
): Query<JoinSelectionResult<TSelection>>;

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "right">,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): QueryStep<TLeft, TMerged>;

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function rightJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "right");
}

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "full">,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): Query<TMerged>;

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>,
  options?: FixedJoinOptions
): Query<JoinSelectionResult<TSelection>>;

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TGuard extends JoinNoMergeGuard<TLeft, TRight> = JoinNoMergeGuard<TLeft, TRight>,
  TMerged extends QueryColumns = JoinColumnsForType<TLeft, TRight, "full">,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: ((left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>) & TGuard,
  options?: FixedJoinOptions
): QueryStep<TLeft, TMerged>;

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function fullJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "full");
}

export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  left: Query<TLeft>,
  selector: (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options?: UnnestOptions<TOuter>
): Query<
  TLeft & UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >
>;

export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  selector: (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options?: UnnestOptions<TOuter>
): QueryStep<
  TLeft,
  TLeft & UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >
>;

export function unnest(...args: unknown[]): unknown {
  if (args[0] instanceof Query) {
    const [left, selector, selection, options] = args;
    return _unnest(
      left as Query<QueryColumns>,
      selector as (cols: ColumnRefs<QueryColumns>) => ExprRef<readonly unknown[] | unknown[] | null>,
      selection as UnnestSelection<string, string | undefined>,
      options as UnnestOptions<boolean | undefined> | undefined
    );
  }

  const [selector, selection, options] = args;
  return (left: Query<QueryColumns>) =>
    _unnest(
      left,
      selector as (cols: ColumnRefs<QueryColumns>) => ExprRef<readonly unknown[] | unknown[] | null>,
      selection as UnnestSelection<string, string | undefined>,
      options as UnnestOptions<boolean | undefined> | undefined
    );
}

function _unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  left: Query<TLeft>,
  selector: (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options: UnnestOptions<TOuter> = {}
): Query<
  TLeft & UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >
> {
  return buildUnnest(left, selector, selection, options);
}

function _join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TSelection extends JoinSelection = ExprRefs<JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >>,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  merge?: JoinColumnMergerForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>> {
  return buildJoin(left, right, on, merge, options);
}

function assertNoLegacyJoinMergeOption(options: unknown): void {
  if (options && typeof options === "object" && "merge" in options) {
    userError(
      "JOIN_MERGE_POSITIONAL_REQUIRED",
      "join() no longer accepts { merge }. Pass merge as the next argument before options."
    );
  }
}

function parseJoinInvocation(args: unknown[]):
  | {
      kind: "data_first";
      left: unknown;
      right: unknown;
      on: unknown;
      merge: unknown;
      options: unknown;
    }
  | {
      kind: "curried";
      right: unknown;
      on: unknown;
      merge: unknown;
      options: unknown;
    } {
  const isDataFirst =
    args[0] instanceof Query &&
    (args.length >= 4 || (args.length === 3 && typeof args[2] === "function"));

  if (isDataFirst) {
    const [left, right, on, maybeMerge, maybeOptions] = args;
    const { merge, options } = parseJoinMergeAndOptions(maybeMerge, maybeOptions);
    return { kind: "data_first", left, right, on, merge, options };
  }

  const [right, on, maybeMerge, maybeOptions] = args;
  const { merge, options } = parseJoinMergeAndOptions(maybeMerge, maybeOptions);
  return { kind: "curried", right, on, merge, options };
}

function parseJoinMergeAndOptions(
  maybeMerge: unknown,
  maybeOptions: unknown
): { merge: unknown; options: unknown } {
  const merge =
    typeof maybeMerge === "function"
      ? maybeMerge
      : undefined;
  const options = typeof maybeMerge === "function"
    ? maybeOptions
    : maybeMerge;
  assertNoLegacyJoinMergeOption(options);
  return { merge, options };
}

function buildFixedJoinOverload(
  args: unknown[],
  type: "inner" | "left" | "right" | "full"
): unknown {
  const parsed = parseJoinInvocation(args);

  if (parsed.kind === "data_first") {
    return _join(
      parsed.left as Query<QueryColumns>,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as (left: ColumnRefs<QueryColumns>, right: ColumnRefs<QueryColumns>) => ExprRef<boolean>,
      parsed.merge as JoinColumnMerger<QueryColumns, QueryColumns, JoinSelection> | undefined,
      { ...(parsed.options as FixedJoinOptions | undefined), type }
    );
  }

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as (left: ColumnRefs<QueryColumns>, right: ColumnRefs<QueryColumns>) => ExprRef<boolean>,
      parsed.merge as JoinColumnMerger<QueryColumns, QueryColumns, JoinSelection> | undefined,
      { ...(parsed.options as FixedJoinOptions | undefined), type }
    );
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
  options?: { dialect?: Dialect; renderStrategy?: SqlRenderStrategy }
): AST {
  return renderPipelineAst(
    query.source,
    query.stages,
    query.columnNames,
    query.sourceScopeId,
    {
      baseCtes: query.withs,
      dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
      renderStrategy: options?.renderStrategy,
    }
  );
}

export function toSql<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): string {
  return renderSql(query, options);
}

export function toSqlResult<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): SqlResult {
  return renderSqlResult(query, options);
}

export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const resolved = buildSqlOptions(options);
  const sqlResult = renderSqlResult(query, options);

  return {
    ir: toIR(query),
    ast: renderPipelineAst(
      query.source,
      query.stages,
      query.columnNames,
      query.sourceScopeId,
      {
        baseCtes: query.withs,
        dialect: resolved.dialect,
      }
    ),
    sql: sqlResult.sql,
    params: sqlResult.params,
    columnNames: query.columnNames,
    stages: query.stages.map((stage, index) => ({
      index,
      kind: stage.kind,
    })),
    ctes: query.withs.map((cte) => ({
      name: cte.name,
      kind: cte.kind,
    })),
    dialect: resolved.dialect,
    format: resolved.sqlFormat,
    renderStrategy: resolved.renderStrategy,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };
}
