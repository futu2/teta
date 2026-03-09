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
