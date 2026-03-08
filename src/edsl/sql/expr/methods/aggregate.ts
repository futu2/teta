import { type ExprInput, type ExprRef, type PropagateNull, type WindowBuilder, type WindowSpecInput } from "../../../core/expr";
import type { SqlFloat, SqlInt, SqlNumber } from "../../types";
import {
  avg,
  count,
  denseRank,
  group,
  lag,
  lead,
  max,
  min,
  ntile,
  percentRank,
  rank,
  rowNumber,
  sum,
  sumOver,
} from "../ops/aggregate";
import { defineExprMethods } from "./shared";

type NullableSqlNumber = SqlNumber | null;

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    group(this: ExprRef<T>): ExprRef<T>;
    count(this: ExprRef<unknown>): ExprRef<SqlInt>;
    sum<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<TValue>;
    avg<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
    min(this: ExprRef<T>): ExprRef<T>;
    max(this: ExprRef<T>): ExprRef<T>;
    rank(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
    denseRank(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
    rowNumber(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
    lag(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T>;
    lead(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T>;
    percentRank(this: ExprRef<unknown>): WindowBuilder<SqlFloat>;
    ntile(this: ExprRef<unknown>, buckets: ExprInput<SqlInt>): WindowBuilder<SqlInt>;
    sumOver<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, spec?: WindowSpecInput): ExprRef<TValue>;
  }
}

defineExprMethods([
  ["group", group],
  ["count", count],
  ["sum", sum],
  ["avg", avg],
  ["min", min],
  ["max", max],
  ["rank", rank],
  ["denseRank", denseRank],
  ["rowNumber", rowNumber],
  ["lag", lag],
  ["lead", lead],
  ["percentRank", percentRank],
  ["ntile", ntile],
  ["sumOver", sumOver],
]);
