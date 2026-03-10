import type { NormalizeNumericLiteral, NormalizeNumericLiteralTuple } from "../../types.ts";
import type { ExprInput, ExprInputTuple, ExprRef, NonNull } from "../core.ts";
import { fn } from "../core.ts";
import { userError } from "../../../errors.ts";

export function coalesce<TValue, TValues extends readonly unknown[]>(
  value: ExprInput<TValue>,
  ...values: ExprInputTuple<NormalizeNumericLiteralTuple<TValue, TValues>>
): ExprRef<NonNull<TValue | NormalizeNumericLiteral<TValue, TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "coalesce requires at least one fallback value");
  }
  return fn<NonNull<TValue | NormalizeNumericLiteral<TValue, TValues[number]>>>(
    "COALESCE",
    value,
    ...values
  );
}

export function nullIf<T>(value: ExprInput<T>, other: ExprInput<T>): ExprRef<T | null> {
  return fn<T | null>("NULLIF", value, other);
}
