import type { ExprInput, ExprRef } from "../core";
import { fn } from "../core";

export function coalesce<T>(
  value: ExprInput<T>,
  ...values: ExprInput<T>[]
): ExprRef<T> {
  if (values.length === 0) {
    throw new Error("coalesce requires at least one fallback value");
  }
  return fn<T>("COALESCE", value, ...values);
}

export function nullIf<T>(value: ExprInput<T>, other: ExprInput<T>): ExprRef<T | null> {
  return fn<T | null>("NULLIF", value, other);
}
