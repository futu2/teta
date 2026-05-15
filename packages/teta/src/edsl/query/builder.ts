import type { AST } from "node-sql-parser";
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
import { createColumnRefs } from "../expr.ts";
import type {
  ColumnRefs,
  ExprLike,
  ExprRef,
  ExprRefs,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import {
  createDeferredRecursiveCte,
  explainIR,
  irToAst,
  irToSql,
  irToSqlResult,
  renderSql,
  renderSqlResult,
  resolveDialect,
} from "../sql.ts";
import type { QueryIRSqlTarget, SqlCompilable } from "../sql.ts";
import { freshInternalCteName, freshScopeId } from "./planner.ts";
import { toQuerySpec } from "./state.ts";
import { assertLoopColumns, normalizeIdentifier, qualifyOuterColumns } from "./utils.ts";
import type {
  CanonicalJoinType,
  JoinColumnMerger,
  JoinColumnMergerForType,
  JoinColumnsForType,
  JoinNoMergeGuard,
  JoinOn,
  JoinOnNoMerge,
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

export type QueryIR<TColumns extends QueryColumns> = QueryIRSqlTarget & {
  columnNames: readonly (keyof TColumns & string)[];
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

type PredicateInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => ExprRef<boolean>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

type UnnestSelectorInput<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
> = (cols: ColumnRefs<TLeft>) => ExprLike<TCollection>;

type JoinOnInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
> = JoinOn<TLeft, TRight>;

type JoinOnNoMergeInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
> = JoinOnNoMerge<TLeft, TRight>;

type JoinMergeInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends "inner" | "left" | "right" | "full",
  TSelection extends JoinSelection,
> =
  | JoinColumnMergerForType<TLeft, TRight, TType, TSelection>
  | TSelection;

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

/** Composable query builder value with typed columns and SQL rendering. */
export type Query<TColumns extends QueryColumns> = Readonly<QueryState<TColumns> & {
  kind: "query";
  state: Readonly<QueryState<TColumns>>;
}>;

export function createQuery<TColumns extends QueryColumns>(
  init: QueryInit<TColumns>
): Query<TColumns> {
  return queryOf(resolveQueryInitDefaults(init));
}

function queryOf<TColumns extends QueryColumns>(
  state: QueryState<TColumns>
): Query<TColumns> {
  const source = freezeQueryStateValue(state.source);
  const stages = freezeQueryStateValue(state.stages) as QueryState<TColumns>["stages"];
  const columnNames = freezeQueryStateValue(state.columnNames);
  const withs = freezeQueryStateValue(state.withs) as QueryState<TColumns>["withs"];
  const columnIdentifiers = freezeQueryStateValue(state.columnIdentifiers);
  const frozenState = Object.freeze({
    ...state,
    source,
    stages,
    // Column refs are currently Proxy-backed; Task 3 will tighten their invariants.
    columns: state.columns,
    columnNames,
    withs,
    columnIdentifiers,
  }) as Readonly<QueryState<TColumns>>;

  return Object.freeze({
    kind: "query" as const,
    state: frozenState,
    source: frozenState.source,
    stages: frozenState.stages,
    columns: frozenState.columns,
    columnNames: frozenState.columnNames,
    sourceScopeId: frozenState.sourceScopeId,
    scopeId: frozenState.scopeId,
    withs: frozenState.withs,
    columnIdentifiers: frozenState.columnIdentifiers,
  });
}

function freezeQueryStateValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") return value;

  const object = value as object;
  const existing = seen.get(object);
  if (existing) return existing as T;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(object, copy);
    for (const item of value) {
      copy.push(freezeQueryStateValue(item, seen));
    }
    return Object.freeze(copy) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const copy: Record<PropertyKey, unknown> = {};
  seen.set(object, copy);
  for (const key of Reflect.ownKeys(value)) {
    copy[key] = freezeQueryStateValue(
      (value as Record<PropertyKey, unknown>)[key],
      seen
    );
  }
  return Object.freeze(copy) as T;
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
  on: JoinOnInput<TLeft, TRight>,
  merge?: JoinMergeInput<
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
      merge as JoinMergeInput<QueryColumns, QueryColumns, CanonicalJoinType<TType>, TSelection> | undefined
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
  selector: UnnestSelectorInput<TLeft, TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options: UnnestOptions<TOuter> = {}
): Query<TLeft & TGenerated> {
  const collection = selector(left.columns);
  return deriveQuery(
    left,
    resolveUnnestQuery<TLeft, TGenerated>(
      left,
      collection,
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
  const selection = selector(query.columns);
  assertProjectionShape(selection);
  return deriveQuery(query, resolveMapQuery(query, selection));
}

function buildFold<
  TColumns extends QueryColumns,
  TSelection extends ProjectionShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<ProjectionResult<TSelection>> {
  const selection = selector(query.columns);
  assertProjectionShape(selection);
  return deriveQuery(query, resolveFoldQuery(query, selection));
}

function buildFilter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: PredicateInput<TColumns>
): Query<TColumns> {
  const resolved = predicate(query.columns);
  return deriveQuery(query, resolveFilterQuery(query, resolved.node));
}

function buildSort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: SortInput<TColumns>
): Query<TColumns> {
  const next = selector(query.columns);
  const items = Array.isArray(next) ? next : [next];
  return deriveQuery(query, resolveSortQuery(query, items));
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
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function map(...args: unknown[]): unknown {
  assertCurriedInvocation("map", "map(selector)", args);
  const [selector] = args;
  assertRowCallback("map", selector);
  return (query: Query<QueryColumns>) =>
    _map(
      query,
      selector as (cols: ColumnRefs<QueryColumns>) => ProjectionShape
    );
}

function _map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>> {
  assertRowCallback("map", selector);
  return buildMap(query, selector);
}

export function fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function fold(...args: unknown[]): unknown {
  assertCurriedInvocation("fold", "fold(selector)", args);
  const [selector] = args;
  assertRowCallback("fold", selector);
  return (query: Query<QueryColumns>) =>
    _fold(
      query,
      selector as (cols: ColumnRefs<QueryColumns>) => ProjectionShape
    );
}

function _fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>> {
  assertRowCallback("fold", selector);
  return buildFold(query, selector);
}

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns>;

export function filter(...args: unknown[]): unknown {
  assertCurriedInvocation("filter", "filter(predicate)", args);
  const [predicate] = args;
  assertRowCallback("filter", predicate);
  return (query: Query<QueryColumns>) =>
    _filter(query, predicate as PredicateInput<QueryColumns>);
}

function _filter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: PredicateInput<TColumns>
): Query<TColumns> {
  assertRowCallback("filter", predicate);
  return buildFilter(query, predicate);
}

export function filterResolved<TColumns extends QueryColumns>(
  predicate: ExprRef<boolean>
): QueryStep<TColumns, TColumns> {
  return (query) => deriveQuery(query, resolveFilterQuery(query, predicate.node));
}

export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort(...args: unknown[]): unknown {
  assertCurriedInvocation("sort", "sort(selector)", args);
  const [selector] = args;
  assertRowCallback("sort", selector);
  return (query: Query<QueryColumns>) =>
    _sort(query, selector as SortInput<QueryColumns>);
}

function _sort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: SortInput<TColumns>
): Query<TColumns> {
  assertRowCallback("sort", selector);
  return buildSort(query, selector);
}

export function take<TColumns extends QueryColumns>(count: number): QueryStep<TColumns, TColumns>;

export function take(...args: unknown[]): unknown {
  assertCurriedInvocation("take", "take(count)", args);
  const [count] = args;
  if (typeof count !== "number") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "take() expects take(count)");
  }
  return (query: Query<QueryColumns>) => _take(query, count as number);
}

function _take<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return buildTake(query, count);
}

export function unionAll<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function unionAll(...args: unknown[]): unknown {
  assertCurriedQueryOperand("unionAll", "unionAll(right)", args);
  const [right] = args;
  return (left: Query<QueryColumns>) => _unionAll(left, right as Query<QueryColumns>);
}

function _unionAll<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union all");
}

export function union<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function union(...args: unknown[]): unknown {
  assertCurriedQueryOperand("union", "union(right)", args);
  const [right] = args;
  return (left: Query<QueryColumns>) => _union(left, right as Query<QueryColumns>);
}

function _union<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union");
}

export function loop<TColumns extends QueryColumns>(
  step: (self: Query<TColumns>) => Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function loop(...args: unknown[]): unknown {
  assertCurriedCallbackOperand("loop", "loop(step)", args);
  const [step] = args;
  return (base: Query<QueryColumns>) =>
    _loop(base, step as (self: Query<QueryColumns>) => Query<QueryColumns>);
}

function _loop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  return buildLoop(base, step);
}

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "inner">>;

export function innerJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "inner");
}

export function innerJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function innerJoinMap(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "inner", "innerJoinMap");
}

export function innerJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function innerJoinMerge(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "inner", "innerJoinMerge");
}

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "left">>;

export function leftJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "left");
}

export function leftJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function leftJoinMap(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "left", "leftJoinMap");
}

export function leftJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function leftJoinMerge(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "left", "leftJoinMerge");
}

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "right">>;

export function rightJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "right");
}

export function rightJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function rightJoinMap(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "right", "rightJoinMap");
}

export function rightJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function rightJoinMerge(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "right", "rightJoinMerge");
}

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "full">>;

export function fullJoin(...args: unknown[]): unknown {
  return buildFixedJoinOverload(args, "full");
}

export function fullJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function fullJoinMap(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "full", "fullJoinMap");
}

export function fullJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function fullJoinMerge(...args: unknown[]): unknown {
  return buildFixedJoinMapOverload(args, "full", "fullJoinMerge");
}

export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  selector: (cols: ColumnRefs<TLeft>) => ExprLike<TCollection>,
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
  assertCurriedInvocation("unnest", "unnest(selector, selection, options?)", args, 2, 3);
  const [selector, selection, options] = args;
  assertRowCallback("unnest", selector);
  return (left: Query<QueryColumns>) =>
    _unnest(
      left,
      selector as UnnestSelectorInput<QueryColumns, readonly unknown[] | unknown[] | null>,
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
  selector: UnnestSelectorInput<TLeft, TCollection>,
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
  assertRowCallback("unnest", selector);
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
  on: JoinOnInput<TLeft, TRight>,
  merge?: JoinMergeInput<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>> {
  assertRowCallback("join", on);
  return buildJoin(left, right, on, merge, options);
}

function assertCurriedInvocation(
  helper: string,
  usage: string,
  args: unknown[],
  minArgs = 1,
  maxArgs = 1
): void {
  if (args.length < minArgs || args.length > maxArgs) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

function assertRowCallback(helper: string, value: unknown): asserts value is (...args: any[]) => unknown {
  if (typeof value !== "function") {
    userError("DEFERRED_INPUT_INVALID", `${helper}() expects a row callback`);
  }
}

export function assertProjectionShape(value: unknown): asserts value is ProjectionShape {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length === 0
  ) {
    userError("LEGACY_SELECTION_ARRAY", "map() and fold() now expect an object shape");
  }
}

function assertCurriedQueryOperand(
  helper: string,
  usage: string,
  args: unknown[]
): void {
  if (args.length !== 1 || !isQuery(args[0])) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

function assertCurriedCallbackOperand(
  helper: string,
  usage: string,
  args: unknown[]
): void {
  if (args.length !== 1 || typeof args[0] !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

type ParsedCurriedJoinInvocation = {
  right: unknown;
  on: unknown;
  merge: unknown;
  options: unknown;
};

function buildFixedJoinOverload(
  args: unknown[],
  type: "inner" | "left" | "right" | "full"
): unknown {
  const helper = fixedJoinHelperName(type);
  const parsed = parseFixedJoinInvocation(args, helper);

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      undefined,
      { ...(parsed.options as FixedJoinOptions | undefined), type }
    );
}

function parseFixedJoinInvocation(
  args: unknown[],
  helper: string
): ParsedCurriedJoinInvocation {
  if (args.length !== 2 && args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, options?)`);
  }
  const [right, on, options] = args;
  assertJoinRight(helper, right, `${helper}(right, on, options?)`);
  assertRowCallback(helper, on);
  assertFixedJoinOptions(helper, options);
  return { right, on, merge: undefined, options };
}

function buildFixedJoinMapOverload(
  args: unknown[],
  type: "inner" | "left" | "right" | "full",
  helper: string
): unknown {
  const parsed = parseFixedJoinMapInvocation(args, helper);

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, typeof type, JoinSelection>,
      { type }
    );
}

function parseFixedJoinMapInvocation(
  args: unknown[],
  helper: string
): ParsedCurriedJoinInvocation {
  if (args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, selector)`);
  }
  const [right, on, merge] = args;
  assertJoinRight(helper, right, `${helper}(right, on, selector)`);
  assertRowCallback(helper, on);
  assertRowCallback(helper, merge);
  return { right, on, merge, options: undefined };
}

function assertJoinRight(helper: string, value: unknown, usage: string): void {
  if (!isQuery(value) && typeof value !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

function assertFixedJoinOptions(helper: string, value: unknown): void {
  if (value === undefined) return;
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isQuery(value)
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }

  const options = value as Record<string, unknown>;
  const keys = Object.keys(options);
  if (
    keys.some((key) => key !== "lateral")
    || ("lateral" in options && typeof options.lateral !== "boolean")
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }
}

function fixedJoinHelperName(type: "inner" | "left" | "right" | "full"): string {
  switch (type) {
    case "inner":
      return "innerJoin";
    case "left":
      return "leftJoin";
    case "right":
      return "rightJoin";
    case "full":
      return "fullJoin";
  }
}

export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns> {
  return {
    source: query.source,
    stages: query.stages,
    scopeId: query.sourceScopeId,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    withs: query.withs,
  };
}

export function toAst<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: { dialect?: Dialect; renderStrategy?: SqlRenderStrategy }
): AST {
  return irToAst(toIR(query), {
    dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
    renderStrategy: options?.renderStrategy,
  });
}

export function toSql<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): string {
  return isQuery(query) ? irToSql(toIR(query), options) : renderSql(query, options);
}

export function toSqlResult<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): SqlResult {
  return isQuery(query) ? irToSqlResult(toIR(query), options) : renderSqlResult(query, options);
}

export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const result = explainIR(toIR(query), options);

  return {
    ir: result.ir,
    ast: result.ast,
    sql: result.sql,
    params: result.params,
    columnNames: result.columnNames,
    stages: result.stages,
    ctes: result.ctes,
    dialect: result.dialect,
    format: result.format,
    renderStrategy: result.renderStrategy,
    parameterMode: result.parameterMode,
    parameterPrefix: result.parameterPrefix,
  };
}

export function isQuery(value: unknown): value is Query<QueryColumns> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    kind?: unknown;
    state?: unknown;
    source?: unknown;
    stages?: unknown;
    columns?: unknown;
    columnNames?: unknown;
    sourceScopeId?: unknown;
    scopeId?: unknown;
    withs?: unknown;
    columnIdentifiers?: unknown;
  };

  if (candidate.kind !== "query" || !isQueryState(candidate.state)) {
    return false;
  }

  const state = candidate.state;
  return candidate.source === state.source
    && candidate.stages === state.stages
    && candidate.columns === state.columns
    && candidate.columnNames === state.columnNames
    && candidate.sourceScopeId === state.sourceScopeId
    && candidate.scopeId === state.scopeId
    && candidate.withs === state.withs
    && candidate.columnIdentifiers === state.columnIdentifiers;
}

function isQueryState(value: unknown): value is Readonly<QueryState<QueryColumns>> {
  if (!isPlainObject(value)) return false;
  const state = value as Partial<QueryState<QueryColumns>>;

  return isSource(state.source)
    && Array.isArray(state.stages)
    && state.stages.every(isStage)
    && isPlainObject(state.columns)
    && isStringArray(state.columnNames)
    && typeof state.sourceScopeId === "string"
    && typeof state.scopeId === "string"
    && Array.isArray(state.withs)
    && state.withs.every(isCteSpec)
    && isColumnIdentifiers(state.columnIdentifiers);
}

function isSource(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if ((value as { kind?: unknown }).kind === "values") {
    const rows = (value as { rows?: unknown }).rows;
    return Array.isArray(rows) && rows.every(isPlainObject);
  }

  const source = value as {
    db?: unknown;
    schema?: unknown;
    table?: unknown;
    as?: unknown;
  };
  return (source.db === null || isSqlIdentifier(source.db))
    && (source.schema === null || isSqlIdentifier(source.schema))
    && isSqlIdentifier(source.table)
    && (source.as === null || isSqlIdentifier(source.as));
}

function isStage(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const stage = value as {
    kind?: unknown;
    items?: unknown;
    keys?: unknown;
    groupBy?: unknown;
    outputScopeId?: unknown;
    predicate?: unknown;
    projectAll?: unknown;
    count?: unknown;
    joinType?: unknown;
    lateral?: unknown;
    source?: unknown;
    as?: unknown;
    on?: unknown;
    rightScopeId?: unknown;
    mode?: unknown;
    expr?: unknown;
    withOrdinality?: unknown;
    columnNames?: unknown;
    columnIdentifiers?: unknown;
    op?: unknown;
    right?: unknown;
  };
  switch (stage.kind) {
    case "map":
      return isProjectionItems(stage.items)
        && isStringArray(stage.keys)
        && stage.groupBy === null
        && typeof stage.outputScopeId === "string";
    case "fold":
      return isProjectionItems(stage.items)
        && isStringArray(stage.keys)
        && (stage.groupBy === null || isExprNodeArray(stage.groupBy))
        && typeof stage.outputScopeId === "string";
    case "filter":
      return isExprNodeLike(stage.predicate) && isProjectionItems(stage.projectAll);
    case "sort":
      return isOrderItems(stage.items) && isProjectionItems(stage.projectAll);
    case "take":
      return typeof stage.count === "number" && isProjectionItems(stage.projectAll);
    case "join":
      return isJoinType(stage.joinType)
        && (stage.lateral === undefined || typeof stage.lateral === "boolean")
        && isJoinSource(stage.source)
        && (stage.as === null || typeof stage.as === "string")
        && isExprNodeLike(stage.on)
        && isProjectionItems(stage.projectAll)
        && typeof stage.rightScopeId === "string"
        && typeof stage.outputScopeId === "string";
    case "unnest":
      return (stage.mode === "inner" || stage.mode === "outer")
        && isExprNodeLike(stage.expr)
        && typeof stage.withOrdinality === "boolean"
        && (stage.as === null || typeof stage.as === "string")
        && isStringArray(stage.columnNames)
        && isColumnIdentifiers(stage.columnIdentifiers)
        && isProjectionItems(stage.projectAll)
        && typeof stage.rightScopeId === "string"
        && typeof stage.outputScopeId === "string";
    case "union":
      return (stage.op === "union" || stage.op === "union all")
        && isProjectionItems(stage.projectAll)
        && isQuerySpec(stage.right)
        && typeof stage.outputScopeId === "string";
    default:
      return false;
  }
}

function isJoinType(value: unknown): boolean {
  return value === "INNER" || value === "LEFT" || value === "RIGHT" || value === "FULL";
}

function isJoinSource(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const source = value as {
    kind?: unknown;
    db?: unknown;
    table?: unknown;
    schema?: unknown;
    columnIdentifiers?: unknown;
    query?: unknown;
    inheritedBindings?: unknown;
  };
  if (source.kind === "table") {
    return (source.db === null || isSqlIdentifier(source.db))
      && isSqlIdentifier(source.table)
      && (source.schema === null || isSqlIdentifier(source.schema))
      && isColumnIdentifiers(source.columnIdentifiers);
  }
  if (source.kind === "subquery") {
    return isQuerySpec(source.query)
      && (source.inheritedBindings === null || isPlainObject(source.inheritedBindings));
  }
  return false;
}

function isProjectionItems(value: unknown): boolean {
  return Array.isArray(value) && value.every(isProjectionItem);
}

function isProjectionItem(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const item = value as { expr?: unknown; as?: unknown };
  return isExprNodeLike(item.expr) && (item.as === null || isSqlIdentifier(item.as));
}

function isOrderItems(value: unknown): boolean {
  return Array.isArray(value) && value.every(isOrderItem);
}

function isOrderItem(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const item = value as { expr?: unknown; direction?: unknown };
  return isExprNodeLike(item.expr) && (item.direction === "ASC" || item.direction === "DESC");
}

function isExprNodeArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isExprNodeLike);
}

function isExprNodeLike(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === "column"
    || kind === "literal"
    || kind === "param"
    || kind === "binary"
    || kind === "unary"
    || kind === "agg"
    || kind === "group"
    || kind === "func"
    || kind === "list"
    || kind === "array"
    || kind === "extract"
    || kind === "cast"
    || kind === "window"
    || kind === "case";
}

function isCteSpec(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const cte = value as {
    kind?: unknown;
    name?: unknown;
    query?: unknown;
    columnNames?: unknown;
    base?: unknown;
    step?: unknown;
  };
  if (cte.kind === "query") {
    return typeof cte.name === "string" && isQuerySpec(cte.query);
  }
  if (cte.kind === "recursive") {
    return typeof cte.name === "string"
      && isStringArray(cte.columnNames)
      && isQuerySpec(cte.base)
      && isQuerySpec(cte.step);
  }
  return false;
}

function isQuerySpec(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const spec = value as {
    source?: unknown;
    stages?: unknown;
    columnNames?: unknown;
    columnIdentifiers?: unknown;
    scopeId?: unknown;
  };
  return isSource(spec.source)
    && Array.isArray(spec.stages)
    && spec.stages.every(isStage)
    && isStringArray(spec.columnNames)
    && isColumnIdentifiers(spec.columnIdentifiers)
    && typeof spec.scopeId === "string";
}

function isColumnIdentifiers(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every(isSqlIdentifier);
}

function isSqlIdentifier(value: unknown): value is SqlIdentifier {
  return isPlainObject(value)
    && typeof (value as { name?: unknown }).name === "string"
    && typeof (value as { quoted?: unknown }).quoted === "boolean";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
