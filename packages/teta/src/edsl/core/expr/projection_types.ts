import type { Value } from "../types.ts";
import type { Expr } from "./runtime.ts";
import type { NormalizeExpressionLiteral } from "../../sql/types.ts";

export type ProjectionValue = Expr<unknown> | Value;

export type ProjectionValueResult<V> = V extends Expr<infer T>
  ? T
  : NormalizeExpressionLiteral<V>;

export type ProjectionShape = Record<string, ProjectionValue>;

export type ProjectionResult<S extends ProjectionShape> = {
  [K in keyof S]: ProjectionValueResult<S[K]>;
};

export type ProjectionSelection = ProjectionShape;
