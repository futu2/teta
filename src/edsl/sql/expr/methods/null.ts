import { type ExprInput, type ExprRef } from "../../../core/expr";
import { coalesce, nullIf } from "../ops/null";
import { defineExprMethods } from "./shared";

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    coalesce(this: ExprRef<T>, ...values: ExprInput<T>[]): ExprRef<T>;
    nullIf(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T | null>;
  }
}

defineExprMethods([
  ["coalesce", coalesce],
  ["nullIf", nullIf],
]);

