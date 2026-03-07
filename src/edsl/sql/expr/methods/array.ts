import { type ExprInput, type ExprRef } from "../../../core/expr";
import type { SqlInt } from "../../types";
import {
  arrayAppend,
  arrayConcat,
  arrayContains,
  arrayDistinct,
  arrayJoin,
  arrayLength,
  arrayPosition,
  arrayPrepend,
  arraySlice,
} from "../ops/array";
import { defineExprMethods } from "./shared";

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    arrayLength(this: ExprRef<unknown>): ExprRef<SqlInt>;
    arrayContains(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<boolean>;
    arrayPosition(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<SqlInt>;
    arraySlice(this: ExprRef<unknown>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<unknown>;
    arrayJoin(this: ExprRef<unknown>, separator: ExprInput<string>): ExprRef<string>;
    arrayAppend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown>;
    arrayPrepend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown>;
    arrayConcat(this: ExprRef<unknown>, ...values: ExprInput<unknown>[]): ExprRef<unknown>;
    arrayDistinct(this: ExprRef<unknown>): ExprRef<unknown>;
  }
}

defineExprMethods([
  ["arrayLength", arrayLength],
  ["arrayContains", arrayContains],
  ["arrayPosition", arrayPosition],
  ["arraySlice", arraySlice],
  ["arrayJoin", arrayJoin],
  ["arrayAppend", arrayAppend],
  ["arrayPrepend", arrayPrepend],
  ["arrayConcat", arrayConcat],
  ["arrayDistinct", arrayDistinct],
]);

