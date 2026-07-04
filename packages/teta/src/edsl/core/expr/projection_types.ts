import type { Value } from "../types.ts";
import type { Expr, ExprPhase } from "./runtime.ts";
import type { NormalizeExpressionLiteral } from "../../sql/types.ts";
import type { QueryValue } from "../../query/types.ts";

type ProjectionKey = Exclude<string, `__teta_${string}`>;

export type ProjectionValue = Expr<any, ExprPhase> | Value;
export type AggregateProjectionValue = Expr<any, "group" | "aggregate"> | Value;

export type ProjectionValueResult<V> = V extends Expr<infer T, ExprPhase>
  ? T
  : NormalizeExpressionLiteral<V>;

type QueryProjectionValue<V> = V extends QueryValue ? V : never;

export type ProjectionShape = Record<ProjectionKey, ProjectionValue>;
export type AggregateProjectionShape = Record<ProjectionKey, AggregateProjectionValue>;

export type ProjectionResult<S extends ProjectionShape> = {
  [K in keyof S]: QueryProjectionValue<ProjectionValueResult<S[K]>>;
};

export type AggregateProjectionResult<S extends AggregateProjectionShape> = {
  [K in keyof S]: QueryProjectionValue<ProjectionValueResult<S[K]>>;
};

export type ProjectionSelection = ProjectionShape;
