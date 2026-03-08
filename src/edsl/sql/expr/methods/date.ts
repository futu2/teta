import { type ExprInput, type ExprRef, type PropagateNull } from "../../../core/expr";
import type { SqlDate, SqlFloat, SqlInt, SqlNumber, SqlTimestamp } from "../../types";
import {
  dateAdd,
  dateDiff,
  dateFormat,
  dateParse,
  dateTrunc,
  day,
  extract,
  fromUnixTime,
  hour,
  minute,
  month,
  second,
  toUnixTime,
  year,
} from "../ops/date";
import { defineExprMethods } from "./shared";

type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableSqlNumber = SqlNumber | null;

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    extract<TValue>(this: ExprRef<TValue>, field: string): ExprRef<PropagateNull<TValue, SqlFloat>>;
    dateTrunc<TValue extends NullableDateLike>(this: ExprRef<TValue>, unit: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
    dateAdd<TValue extends NullableDateLike>(this: ExprRef<TValue>, unit: ExprInput<string>, amount: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
    dateDiff<TValue extends NullableDateLike>(this: ExprRef<TValue>, unit: ExprInput<string>, other: ExprInput<NullableDateLike>): ExprRef<PropagateNull<TValue | NullableDateLike, SqlInt>>;
    dateFormat<TValue extends NullableDateLike>(this: ExprRef<TValue>, format: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
    dateParse<TValue extends string | null>(this: ExprRef<TValue>, format: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
    toUnixTime<TValue extends NullableDateLike>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
    fromUnixTime<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
    year<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    month<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    day<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    hour<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    minute<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    second<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  }
}

defineExprMethods([
  ["extract", extract],
  ["dateTrunc", dateTrunc],
  ["dateAdd", dateAdd],
  ["dateDiff", dateDiff],
  ["dateFormat", dateFormat],
  ["dateParse", dateParse],
  ["toUnixTime", toUnixTime],
  ["fromUnixTime", fromUnixTime],
  ["year", year],
  ["month", month],
  ["day", day],
  ["hour", hour],
  ["minute", minute],
  ["second", second],
]);
