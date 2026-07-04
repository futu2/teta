import type {
  QueryInit,
  QueryState,
} from "./state.ts";
import { resolveQueryInitDefaults } from "./state.ts";
import { isPlainObject } from "./value.ts";

type QueryColumns = Record<string, any>;

export type QueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
> = (query: Query<TInputColumns>) => Query<TOutputColumns>;

export type QueryStageKind = "map" | "fold" | "filter" | "sort" | "take" | "join" | "unnest" | "union";

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
