import { type ExprInput, type ExprRef } from "../../../core/expr";
import type { SqlDate, SqlFloat, SqlInt, SqlNumber, SqlTimestamp } from "../../types";
import {
  abs,
  add,
  cast,
  ceil,
  div,
  floor,
  greatest,
  least,
  mod,
  mul,
  pow,
  round,
  sqrt,
  sub,
  toFloat,
  toInt,
} from "../ops/math";
import { toDate } from "../ops/date";
import { defineExprMethods } from "./shared";

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    add<TValue extends SqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    sub<TValue extends SqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    mul<TValue extends SqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    div<TValue extends SqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    mod<TValue extends SqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    ceil(this: ExprRef<SqlNumber>): ExprRef<SqlInt>;
    floor(this: ExprRef<SqlNumber>): ExprRef<SqlInt>;
    abs<TValue extends SqlNumber>(this: ExprRef<TValue>): ExprRef<TValue>;
    sqrt(this: ExprRef<SqlNumber>): ExprRef<SqlFloat>;
    pow(this: ExprRef<SqlNumber>, exponent: ExprInput<SqlNumber>): ExprRef<SqlFloat>;
    greatest<TValue extends SqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
    least<TValue extends SqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
    cast<TTarget = unknown>(target: string): ExprRef<TTarget>;
    toInt(this: ExprRef<SqlNumber>): ExprRef<SqlInt>;
    toFloat(this: ExprRef<SqlNumber>): ExprRef<SqlFloat>;
    toDate(this: ExprRef<SqlTimestamp>): ExprRef<SqlDate>;
    round(this: ExprRef<SqlNumber>, scale?: ExprInput<SqlInt>): ExprRef<SqlNumber>;
  }
}

defineExprMethods([
  ["add", add],
  ["sub", sub],
  ["mul", mul],
  ["div", div],
  ["mod", mod],
  ["ceil", ceil],
  ["floor", floor],
  ["abs", abs],
  ["sqrt", sqrt],
  ["pow", pow],
  ["greatest", greatest],
  ["least", least],
  ["cast", cast],
  ["toInt", toInt],
  ["toFloat", toFloat],
  ["toDate", toDate],
  ["round", round],
]);

