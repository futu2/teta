import type { Value } from "../types.ts";
import type { ExprRef } from "./runtime.ts";

export type SelectValue = ExprRef<unknown> | Value;

export type SelectValueResult<V> = V extends ExprRef<infer T>
  ? T
  : V;

export type SelectShape = Record<string, SelectValue>;

export type SelectResult<S extends SelectShape> = {
  [K in keyof S]: SelectValueResult<S[K]>;
};

export type SelectSelection = SelectShape;
