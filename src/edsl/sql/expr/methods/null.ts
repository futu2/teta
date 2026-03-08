import { type ExprInput, type ExprInputTuple, type ExprRef, type NonNull } from "../../../core/expr";
import { coalesce, nullIf } from "../ops/null";
import { defineExprMethods } from "./shared";

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    coalesce<TValues extends readonly unknown[]>(this: ExprRef<T>, ...values: ExprInputTuple<TValues>): ExprRef<NonNull<T | TValues[number]>>;
    nullIf(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T | null>;
  }
}

defineExprMethods([
  ["coalesce", coalesce],
  ["nullIf", nullIf],
]);
