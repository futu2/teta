import { type ExprInput, type ExprInputTuple, type ExprRef, type NonNull } from "../../../core/expr";
import type { NormalizeNumericLiteral, NormalizeNumericLiteralTuple } from "../../types";
import { coalesce, nullIf } from "../ops/null";
import { defineExprMethods } from "./shared";

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    coalesce<TValues extends readonly unknown[]>(
      this: ExprRef<T>,
      ...values: ExprInputTuple<NormalizeNumericLiteralTuple<T, TValues>>
    ): ExprRef<NonNull<T | NormalizeNumericLiteral<T, TValues[number]>>>;
    nullIf(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T | null>;
  }
}

defineExprMethods([
  ["coalesce", coalesce],
  ["nullIf", nullIf],
]);
