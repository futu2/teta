import type { Value } from "../types.ts";
import type { Expr, ExprPhase } from "./runtime.ts";
import type { NormalizeExpressionLiteral } from "../../sql/types.ts";
import type { QueryValue } from "../../query/types.ts";

type ProjectionKey = Exclude<string, `__teta_${string}`>;

/** Expression inputs accepted by a row projection. */
export type ProjectionValue = Expr<unknown, ExprPhase> | Value;
/** Expression inputs accepted by an aggregate projection. */
export type AggregateProjectionValue = Expr<unknown, "group" | "aggregate"> | Value;

export type ProjectionValueResult<V> = V extends Expr<infer T, ExprPhase>
  ? T
  : NormalizeExpressionLiteral<V>;

type QueryProjectionValue<V> = V extends QueryValue ? V : never;

export type ProjectionShape = Record<ProjectionKey, ProjectionValue>;
export type AggregateProjectionShape = Record<ProjectionKey, AggregateProjectionValue>;

export type ProjectionResult<S extends ProjectionShape> = {
  [K in keyof S]: Extract<ProjectionValueResult<S[K]>, QueryValue>;
};

export type AggregateProjectionResult<S extends AggregateProjectionShape> = {
  [K in keyof S]: Extract<ProjectionValueResult<S[K]>, QueryValue>;
};

export type ProjectionSelection = ProjectionShape;
