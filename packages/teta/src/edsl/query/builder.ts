import type { OrderItem } from "../core/types.ts";
import type {
  SqlBoolean,
} from "../sql/types.ts";
import { toExprNode } from "../expr.ts";
import type {
  ColumnRefs,
  Expr,
} from "../expr.ts";
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
  resolveFilterQuery,
  resolveTakeQuery,
  resolveSortQuery,
  resolveUnionQuery,
} from "./mutations.ts";
import { userError } from "../errors.ts";
import { isPlainObject, isQuery } from "./value.ts";

type QueryColumns = Record<string, any>;

export type QueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
> = (query: Query<TInputColumns>) => Query<TOutputColumns>;

export type QueryStageKind = "map" | "fold" | "filter" | "sort" | "take" | "join" | "unnest" | "union";

type PredicateInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

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

function assertCurriedQueryOperand(
  helper: string,
  usage: string,
  args: unknown[]
): void {
  if (args.length !== 1 || !isQuery(args[0])) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}
