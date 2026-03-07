import { type ExprInput, type ExprRef } from "../../../core/expr";
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

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    extract(this: ExprRef<unknown>, field: string): ExprRef<SqlFloat>;
    dateTrunc(this: ExprRef<SqlDate | SqlTimestamp | string>, unit: ExprInput<string>): ExprRef<SqlTimestamp>;
    dateAdd(this: ExprRef<SqlDate | SqlTimestamp | string>, unit: ExprInput<string>, amount: ExprInput<SqlInt>): ExprRef<SqlTimestamp>;
    dateDiff(this: ExprRef<SqlDate | SqlTimestamp | string>, unit: ExprInput<string>, other: ExprInput<SqlDate | SqlTimestamp | string>): ExprRef<SqlInt>;
    dateFormat(this: ExprRef<SqlDate | SqlTimestamp | string>, format: ExprInput<string>): ExprRef<string>;
    dateParse(this: ExprRef<string>, format: ExprInput<string>): ExprRef<SqlTimestamp>;
    toUnixTime(this: ExprRef<SqlDate | SqlTimestamp | string>): ExprRef<SqlFloat>;
    fromUnixTime(this: ExprRef<SqlNumber>): ExprRef<SqlTimestamp>;
    year(this: ExprRef<unknown>): ExprRef<SqlInt>;
    month(this: ExprRef<unknown>): ExprRef<SqlInt>;
    day(this: ExprRef<unknown>): ExprRef<SqlInt>;
    hour(this: ExprRef<unknown>): ExprRef<SqlInt>;
    minute(this: ExprRef<unknown>): ExprRef<SqlInt>;
    second(this: ExprRef<unknown>): ExprRef<SqlInt>;
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

