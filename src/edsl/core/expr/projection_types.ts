import type { Value } from "../types.ts";
import type { ExprRef } from "./runtime.ts";

export type ProjectionValue = ExprRef<unknown> | Value;

export type ProjectionValueResult<V> = V extends ExprRef<infer T>
  ? T
  : V;

export type ProjectionShape = Record<string, ProjectionValue>;

export type ProjectionResult<S extends ProjectionShape> = {
  [K in keyof S]: ProjectionValueResult<S[K]>;
};

export type ProjectionSelection = ProjectionShape;
