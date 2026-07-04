import type {
  AggregateProjectionResult,
  AggregateProjectionShape,
  ColumnRefs,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import {
  assertCurriedInvocation,
  assertRowCallback,
} from "./invocation.ts";
import {
  resolveFoldQuery,
  resolveMapQuery,
} from "./transitions.ts";
import { assertProjectionShape } from "./projection_validation.ts";
import type { QueryColumns } from "./types.ts";

function buildMap<
  TColumns extends QueryColumns,
  TSelection extends ProjectionShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<ProjectionResult<TSelection>> {
  const selection = selector(query.columns);
  assertProjectionShape(selection);
  return deriveQuery(query, resolveMapQuery(getQueryState(query), selection));
}

function buildFold<
  TColumns extends QueryColumns,
  TSelection extends AggregateProjectionShape,
>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => TSelection
): Query<AggregateProjectionResult<TSelection>> {
  const selection = selector(query.columns);
  assertProjectionShape(selection);
  return deriveQuery(query, resolveFoldQuery(getQueryState(query), selection));
}

export function map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function map(...args: unknown[]): unknown {
  assertCurriedInvocation("map", "map(selector)", args);
  const [selector] = args;
  assertRowCallback("map", selector);
  return createQueryStep("map", (query: Query<QueryColumns>) =>
    _map(
      query,
      selector as (cols: ColumnRefs<QueryColumns>) => ProjectionShape
    ));
}

function _map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<ProjectionResult<Sel>> {
  assertRowCallback("map", selector);
  return buildMap(query, selector);
}

export function fold<TColumns extends QueryColumns, const Sel extends AggregateProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, AggregateProjectionResult<Sel>>;

export function fold(...args: unknown[]): unknown {
  assertCurriedInvocation("fold", "fold(selector)", args);
  const [selector] = args;
  assertRowCallback("fold", selector);
  return createQueryStep("fold", (query: Query<QueryColumns>) =>
    _fold(
      query,
      selector as (cols: ColumnRefs<QueryColumns>) => AggregateProjectionShape
    ));
}

function _fold<TColumns extends QueryColumns, const Sel extends AggregateProjectionShape>(
  query: Query<TColumns>,
  selector: (cols: ColumnRefs<TColumns>) => Sel
): Query<AggregateProjectionResult<Sel>> {
  assertRowCallback("fold", selector);
  return buildFold(query, selector);
}
