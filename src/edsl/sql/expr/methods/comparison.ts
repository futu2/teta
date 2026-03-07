import type { OrderItem } from "../../../core/types";
import { type ExprInput, type ExprRef } from "../../../core/expr";
import type { SqlDate, SqlNumber, SqlTimestamp } from "../../types";
import { and, asc, desc, eq, gt, gte, isIn, isNotNull, isNull, like, lt, lte, ne, not, or } from "../ops/comparison";
import { defineExprMethods } from "./shared";

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp;

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    eq(value: ExprInput<T>): ExprRef<boolean>;
    ne(value: ExprInput<T>): ExprRef<boolean>;
    gt<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
    gte<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
    lt<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
    lte<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
    like(this: ExprRef<string>, value: ExprInput<string>): ExprRef<boolean>;
    ["in"](values: readonly ExprInput<T>[]): ExprRef<boolean>;
    and(this: ExprRef<boolean>, value: ExprInput<boolean>): ExprRef<boolean>;
    or(this: ExprRef<boolean>, value: ExprInput<boolean>): ExprRef<boolean>;
    not(this: ExprRef<boolean>): ExprRef<boolean>;
    isNull(): ExprRef<boolean>;
    isNotNull(): ExprRef<boolean>;
    asc(): OrderItem;
    desc(): OrderItem;
  }
}

defineExprMethods([
  ["eq", eq],
  ["ne", ne],
  ["gt", gt],
  ["gte", gte],
  ["lt", lt],
  ["lte", lte],
  ["like", like],
  ["in", isIn],
  ["and", and],
  ["or", or],
  ["not", not],
  ["isNull", isNull],
  ["isNotNull", isNotNull],
  ["asc", asc],
  ["desc", desc],
]);

