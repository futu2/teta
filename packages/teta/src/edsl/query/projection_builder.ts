import type {
  ColumnRefs,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import { userError } from "../errors.ts";
import type { Query, QueryStep } from "./builder.ts";
import { deriveQuery } from "./derive.ts";
import {
  resolveFoldQuery,
  resolveMapQuery,
} from "./mutations.ts";

type QueryColumns = Record<string, any>;

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
