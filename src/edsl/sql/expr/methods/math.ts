import { type ExprInput, type ExprRef, type PropagateNull } from "../../../core/expr";
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

type NullableSqlNumber = SqlNumber | null;

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    add<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    sub<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    mul<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    div<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    mod<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
    ceil<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    floor<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    abs<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<TValue>;
    sqrt<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
    pow<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, exponent: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
    greatest<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
    least<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
    cast<TTarget = unknown>(target: string): ExprRef<TTarget>;
    toInt<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    toFloat<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
    toDate<TValue extends SqlTimestamp | null>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlDate>>;
    round<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, scale?: ExprInput<SqlInt>): ExprRef<TValue>;
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
