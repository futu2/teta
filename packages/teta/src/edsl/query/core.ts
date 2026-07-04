import type {
  QueryInit,
  QueryState,
} from "./state.ts";
import { resolveQueryInitDefaults } from "./state.ts";
import type { ColumnRefs } from "../expr.ts";
import type { QueryColumns } from "./types.ts";

const QUERY_BRAND: unique symbol = Symbol("teta.query");
const QUERY_STATE: unique symbol = Symbol("teta.query.state");
const QUERY_STEP_BRAND: unique symbol = Symbol("teta.query_step");

export type QueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
> = ((query: Query<TInputColumns>) => Query<TOutputColumns>) & {
  readonly kind: "query_step";
  readonly stepName: string;
  readonly [QUERY_STEP_BRAND]: true;
};

export type QueryStageKind = "map" | "fold" | "filter" | "sort" | "take" | "join" | "unnest" | "union";

/** Composable query builder value with typed columns and SQL rendering. */
export type Query<TColumns extends QueryColumns> = Readonly<{
  kind: "query";
  columns: ColumnRefs<TColumns>;
  [QUERY_BRAND]: true;
  [QUERY_STATE]: Readonly<QueryState<TColumns>>;
}>;

export function hasQueryBrand(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { [QUERY_BRAND]?: unknown })[QUERY_BRAND] === true);
}

export function hasQueryStepBrand(value: unknown): boolean {
  return Boolean(value && typeof value === "function" && (value as { [QUERY_STEP_BRAND]?: unknown })[QUERY_STEP_BRAND] === true);
}

export function createQueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
>(
  stepName: string,
  apply: (query: Query<TInputColumns>) => Query<TOutputColumns>
): QueryStep<TInputColumns, TOutputColumns> {
  const step = ((query: Query<TInputColumns>) => apply(query)) as QueryStep<TInputColumns, TOutputColumns>;
  Object.defineProperty(step, "kind", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: "query_step",
  });
  Object.defineProperty(step, "stepName", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: stepName,
  });
  Object.defineProperty(step, QUERY_STEP_BRAND, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  });
  return Object.freeze(step);
}

export function createQuery<TColumns extends QueryColumns>(
  init: QueryInit<TColumns>
): Query<TColumns> {
  return queryOf(resolveQueryInitDefaults(init));
}

export function getQueryState<TColumns extends QueryColumns>(
  query: Query<TColumns>
): Readonly<QueryState<TColumns>> {
  return query[QUERY_STATE];
}

function queryOf<TColumns extends QueryColumns>(
  state: QueryState<TColumns>
): Query<TColumns> {
  const source = freezeQueryStateValue(state.source);
  const stages = freezeQueryStateValue(state.stages) as QueryState<TColumns>["stages"];
  const columnNames = freezeQueryStateValue(state.columnNames);
  const withs = freezeQueryStateValue(state.withs) as QueryState<TColumns>["withs"];
  const columnIdentifiers = freezeQueryStateValue(state.columnIdentifiers);
  const nameSupply = freezeQueryStateValue(state.nameSupply);
  const frozenState = Object.freeze({
    ...state,
    source,
    stages,
    columns: state.columns,
    columnNames,
    withs,
    columnIdentifiers,
    nameSupply,
  }) as Readonly<QueryState<TColumns>>;

  const query = {
    kind: "query" as const,
    columns: frozenState.columns,
  } as Omit<Query<TColumns>, typeof QUERY_BRAND | typeof QUERY_STATE> & {
    [QUERY_BRAND]?: true;
    [QUERY_STATE]?: Readonly<QueryState<TColumns>>;
  };
  Object.defineProperty(query, QUERY_BRAND, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  });
  Object.defineProperty(query, QUERY_STATE, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: frozenState,
  });
  return Object.freeze(query) as Query<TColumns>;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
