import type { AST } from "node-sql-parser";
import type {
  CteSpec,
  ExprNode,
  InternalCteName,
  JoinTypeInput,
  OrderItem,
  ProjectionItem,
  QuerySpec,
  ScopeId,
  SqlIdentifier,
  Source,
  Stage,
} from "../core/types.ts";
import type {
  Dialect,
  QueryDialect,
  SqlBoolean,
  SqlFormat,
  SqlInt,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
} from "../sql/types.ts";
import { createColumnRefs, isExprNode, toExprNode } from "../expr.ts";
import type {
  ColumnRefs,
  Expr,
  Exprs,
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
type ScopeRewriteMap = Map<string, ScopeId>;
type CteRewriteMap = Map<string, InternalCteName>;

type CanonicalizeContext = {
  scopes: ScopeRewriteMap;
  ctes: CteRewriteMap;
  nextScopeIndex: number;
  nextCteIndex: number;
};

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
  (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

type UnnestSelectorInput<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
> = (cols: ColumnRefs<TLeft>) => Expr<TCollection>;

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

type JoinConfigWithoutSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined,
> = JoinOptions<TType> & {
  on: JoinOnNoMerge<TLeft, TRight>;
  select?: undefined;
};

type JoinConfigWithSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined,
  TSelection extends JoinSelection,
> = JoinOptions<TType> & {
  on: JoinOnInput<TLeft, TRight>;
  select: JoinColumnMergerForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >;
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

export type JoinRightInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
> = Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>);

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
  TSelection extends JoinSelection = Exprs<JoinColumnsForType<
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
  predicate: (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>
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
  predicate: Expr<SqlBoolean | null>
): QueryStep<TColumns, TColumns> {
  return (query) => deriveQuery(query, resolveFilterQuery(query, toExprNode(predicate)));
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
  if (!Number.isInteger(count) || count < 0) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "take() expects a finite non-negative integer count"
    );
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

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  config: JoinConfigWithoutSelect<TLeft, TRight, TType>
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, CanonicalJoinType<TType>>>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  config: JoinConfigWithSelect<TLeft, TRight, TType, TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function join(...args: unknown[]): unknown {
  const parsed = parseJoinInvocation(args);
  return buildJoinStep(parsed);
}

export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  selector: (cols: ColumnRefs<TLeft>) => Expr<TCollection>,
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
  TSelection extends JoinSelection = Exprs<JoinColumnsForType<
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

type ParsedJoinInvocation = ParsedCurriedJoinInvocation;

function buildJoinStep(parsed: ParsedJoinInvocation): QueryStep<QueryColumns, QueryColumns> {
  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, "inner" | "left" | "right" | "full", JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinTypeInput | undefined> | undefined
    );
}

function parseJoinInvocation(args: unknown[]): ParsedJoinInvocation {
  const usage = "join(right, { type?, on, select?, lateral? })";
  if (args.length !== 2) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `join() expects ${usage}`);
  }

  const [right, config] = args;
  assertJoinRight("join", right, usage);
  assertJoinConfig(config);

  return {
    right,
    on: config.on,
    merge: config.select,
    options: {
      type: config.type,
      lateral: config.lateral,
    },
  };
}

function assertJoinConfig(value: unknown): asserts value is {
  type?: JoinTypeInput;
  on: (...args: any[]) => unknown;
  select?: (...args: any[]) => unknown;
  lateral?: boolean;
} {
  if (!isPlainObject(value) || isQuery(value)) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "join() expects join(right, { type?, on, select?, lateral? })"
    );
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "type" && key !== "on" && key !== "select" && key !== "lateral")) {
    userError(
      "DEFERRED_INPUT_INVALID",
      "join() options must be { type?, on, select?, lateral? }"
    );
  }

  if (typeof value.on !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() expects a row callback in options.on");
  }
  if (value.select !== undefined && typeof value.select !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() options.select must be a row callback");
  }
  if (value.type !== undefined && !isJoinTypeInputValue(value.type)) {
    userError("DEFERRED_INPUT_INVALID", "join() options.type must be inner, left, right, or full");
  }
  if (value.lateral !== undefined && typeof value.lateral !== "boolean") {
    userError("DEFERRED_INPUT_INVALID", "join() options.lateral must be boolean");
  }
}

function assertJoinRight(helper: string, value: unknown, usage: string): void {
  if (!isQuery(value) && typeof value !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

function isJoinTypeInputValue(value: unknown): value is JoinTypeInput {
  return value === "inner"
    || value === "left"
    || value === "right"
    || value === "full"
    || value === "INNER"
    || value === "LEFT"
    || value === "RIGHT"
    || value === "FULL";
}

export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns> {
  return canonicalizeIR({
    source: query.source,
    stages: query.stages,
    scopeId: query.sourceScopeId,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    withs: query.withs,
  }) as QueryIR<TColumns>;
}

function canonicalizeIR<TColumns extends QueryColumns>(
  ir: QueryIR<TColumns>
): QueryIR<TColumns> {
  const context: CanonicalizeContext = {
    scopes: new Map(),
    ctes: new Map(),
    nextScopeIndex: 0,
    nextCteIndex: 0,
  };

  return {
    ...ir,
    source: rewriteSource(ir.source, context),
    scopeId: rewriteScopeId(ir.scopeId, context),
    stages: ir.stages.map((stage) => rewriteStage(stage, context)),
    withs: ir.withs?.map((cte) => rewriteCte(cte, context)) ?? [],
  };
}

function rewriteQuerySpec(spec: QuerySpec, context: CanonicalizeContext): QuerySpec {
  return {
    ...spec,
    source: rewriteSource(spec.source, context),
    scopeId: rewriteScopeId(spec.scopeId, context),
    stages: spec.stages.map((stage) => rewriteStage(stage, context)),
  };
}

function rewriteCte(cte: CteSpec, context: CanonicalizeContext): CteSpec {
  switch (cte.kind) {
    case "query":
      return {
        ...cte,
        query: rewriteQuerySpec(cte.query, context),
      };
    case "recursive":
      return {
        ...cte,
        name: rewriteInternalCteName(cte.name, context),
        base: rewriteQuerySpec(cte.base, context),
        step: rewriteQuerySpec(cte.step, context),
      };
  }
}

function rewriteStage(stage: Stage, context: CanonicalizeContext): Stage {
  switch (stage.kind) {
    case "map":
      return {
        ...stage,
        items: stage.items.map((item) => rewriteProjectionItem(item, context)),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "fold":
      return {
        ...stage,
        items: stage.items.map((item) => rewriteProjectionItem(item, context)),
        groupBy: stage.groupBy?.map((expr) => rewriteExprNode(expr, context)) ?? null,
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "filter":
      return {
        ...stage,
        predicate: rewriteExprNode(stage.predicate, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "sort":
      return {
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          expr: rewriteExprNode(item.expr, context),
        })),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "take":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "join":
      return {
        ...stage,
        source: stage.source.kind === "subquery"
          ? {
              ...stage.source,
              query: rewriteQuerySpec(stage.source.query, context),
              inheritedBindings: rewriteInheritedBindings(stage.source.inheritedBindings, context),
            }
          : {
              ...stage.source,
              table: isInternalCteNameValue(stage.source.table.name)
                ? {
                    ...stage.source.table,
                    name: rewriteInternalCteName(
                      stage.source.table.name as InternalCteName,
                      context
                    ),
                  }
                : stage.source.table,
            },
        on: rewriteExprNode(stage.on, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        rightScopeId: rewriteScopeId(stage.rightScopeId, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "unnest":
      return {
        ...stage,
        expr: rewriteExprNode(stage.expr, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        rightScopeId: rewriteScopeId(stage.rightScopeId, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "union":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        right: rewriteQuerySpec(stage.right, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
  }
}

function rewriteSource(source: Source, context: CanonicalizeContext): Source {
  if ("kind" in source || !isInternalCteNameValue(source.table.name)) return source;
  return {
    ...source,
    table: {
      ...source.table,
      name: rewriteInternalCteName(source.table.name as InternalCteName, context),
    },
  };
}

function rewriteProjectionItem(
  item: ProjectionItem,
  context: CanonicalizeContext
): ProjectionItem {
  return {
    ...item,
    expr: rewriteExprNode(item.expr, context),
  };
}

function rewriteExprNode<T>(expr: ExprNode<T>, context: CanonicalizeContext): ExprNode<T> {
  switch (expr.kind) {
    case "column":
      return {
        ...expr,
        table: rewriteExprTable(expr.table, context),
      } as ExprNode<T>;
    case "literal":
    case "param":
      return expr;
    case "binary":
      return {
        ...expr,
        left: rewriteExprNode(expr.left, context),
        right: rewriteExprNode(expr.right, context),
      } as ExprNode<T>;
    case "unary":
    case "group":
      return {
        ...expr,
        expr: rewriteExprNode(expr.expr, context),
      } as ExprNode<T>;
    case "agg":
      return {
        ...expr,
        arg: rewriteExprNode(expr.arg, context),
      } as ExprNode<T>;
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprNode(arg, context)),
      } as ExprNode<T>;
    case "list":
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteExprNode(item, context)),
      } as ExprNode<T>;
    case "extract":
      return {
        ...expr,
        source: rewriteExprNode(expr.source, context),
      } as ExprNode<T>;
    case "cast":
      return {
        ...expr,
        expr: rewriteExprNode(expr.expr, context),
      } as ExprNode<T>;
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprNode(arg, context)),
        partitionBy: expr.partitionBy?.map((item) => rewriteExprNode(item, context)) ?? null,
        orderBy: expr.orderBy?.map((item) => ({
          ...item,
          expr: rewriteExprNode(item.expr, context),
        })) ?? null,
      } as ExprNode<T>;
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: rewriteExprNode(item.when, context),
          then: rewriteExprNode(item.then, context),
        })),
        elseExpr: expr.elseExpr ? rewriteExprNode(expr.elseExpr, context) : null,
      } as ExprNode<T>;
  }
}

function rewriteExprTable(
  table: string | null,
  context: CanonicalizeContext
): string | null {
  if (table === null) return null;
  if (!isInternalScopeNameValue(table)) return table;
  return rewriteScopeId(table as ScopeId, context);
}

function rewriteInheritedBindings(
  bindings: Readonly<Partial<Record<ScopeId, string | null>>> | null,
  context: CanonicalizeContext
): Readonly<Partial<Record<ScopeId, string | null>>> | null {
  if (!bindings) return null;
  const rewritten: Partial<Record<ScopeId, string | null>> = {};
  for (const [scopeId, alias] of Object.entries(bindings)) {
    rewritten[rewriteScopeId(scopeId as ScopeId, context)] = alias;
  }
  return rewritten;
}

function rewriteScopeId(scopeId: ScopeId, context: CanonicalizeContext): ScopeId {
  const existing = context.scopes.get(scopeId);
  if (existing) return existing;
  const next = `__teta_scope_${context.nextScopeIndex++}` as ScopeId;
  context.scopes.set(scopeId, next);
  return next;
}

function rewriteInternalCteName(
  name: InternalCteName,
  context: CanonicalizeContext
): InternalCteName {
  const existing = context.ctes.get(name);
  if (existing) return existing;
  const next = `__teta_cte_loop_${context.nextCteIndex++}` as InternalCteName;
  context.ctes.set(name, next);
  return next;
}

function isInternalScopeNameValue(value: string): boolean {
  return value.startsWith("__teta_scope_");
}

function isInternalCteNameValue(value: string): boolean {
  return value.startsWith("__teta_cte_");
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
      return isExprNode(stage.predicate) && isProjectionItems(stage.projectAll);
    case "sort":
      return isOrderItems(stage.items) && isProjectionItems(stage.projectAll);
    case "take":
      return typeof stage.count === "number" && isProjectionItems(stage.projectAll);
    case "join":
      return isJoinType(stage.joinType)
        && (stage.lateral === undefined || typeof stage.lateral === "boolean")
        && isJoinSource(stage.source)
        && (stage.as === null || typeof stage.as === "string")
        && isExprNode(stage.on)
        && isProjectionItems(stage.projectAll)
        && typeof stage.rightScopeId === "string"
        && typeof stage.outputScopeId === "string";
    case "unnest":
      return (stage.mode === "inner" || stage.mode === "outer")
        && isExprNode(stage.expr)
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
  return isExprNode(item.expr) && (item.as === null || isSqlIdentifier(item.as));
}

function isOrderItems(value: unknown): boolean {
  return Array.isArray(value) && value.every(isOrderItem);
}

function isOrderItem(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const item = value as { expr?: unknown; direction?: unknown };
  return isExprNode(item.expr) && (item.direction === "ASC" || item.direction === "DESC");
}

function isExprNodeArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isExprNode);
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
