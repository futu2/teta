import type { DateLiteral, TimestampLiteral } from "../../../core/types";
import type {
  SqlDate,
  SqlFloat,
  SqlInt,
  SqlNumber,
  SqlTimestamp,
} from "../../types";
import { ExprRef, fn, funcExpr, toExprNode, type ExprInput } from "../core";
import { cast } from "./math";

export function currentDate(): ExprRef<SqlDate> {
  return funcExpr("CURRENT_DATE", []);
}

export function currentTimestamp(): ExprRef<SqlTimestamp> {
  return funcExpr("CURRENT_TIMESTAMP", []);
}

export function dateLiteral(value: string): ExprRef<SqlDate> {
  return new ExprRef<SqlDate>({
    kind: "literal",
    value: { kind: "date_literal", value } as DateLiteral,
  });
}

export function timestampLiteral(value: string): ExprRef<SqlTimestamp> {
  return new ExprRef<SqlTimestamp>({
    kind: "literal",
    value: { kind: "timestamp_literal", value } as TimestampLiteral,
  });
}

export function extract(value: ExprInput<unknown>, field: string): ExprRef<SqlFloat> {
  if (!field.trim()) {
    throw new Error("extract requires a field");
  }
  return new ExprRef<SqlFloat>({
    kind: "extract",
    field,
    source: toExprNode(value),
  });
}

export function dateTrunc(
  value: ExprInput<SqlDate | SqlTimestamp | string>,
  unit: ExprInput<string>
): ExprRef<SqlTimestamp> {
  return fn<SqlTimestamp>("DATE_TRUNC", unit, value);
}

export function dateAdd(
  value: ExprInput<SqlDate | SqlTimestamp | string>,
  unit: ExprInput<string>,
  amount: ExprInput<SqlInt>
): ExprRef<SqlTimestamp> {
  return fn<SqlTimestamp>("DATE_ADD", unit, amount, value);
}

export function dateDiff(
  value: ExprInput<SqlDate | SqlTimestamp | string>,
  unit: ExprInput<string>,
  other: ExprInput<SqlDate | SqlTimestamp | string>
): ExprRef<SqlInt> {
  return fn<SqlInt>("DATE_DIFF", unit, value, other);
}

export function dateFormat(
  value: ExprInput<SqlDate | SqlTimestamp | string>,
  format: ExprInput<string>
): ExprRef<string> {
  return fn<string>("DATE_FORMAT", value, format);
}

export function dateParse(
  value: ExprInput<string>,
  format: ExprInput<string>
): ExprRef<SqlTimestamp> {
  return fn<SqlTimestamp>("DATE_PARSE", value, format);
}

export function toUnixTime(
  value: ExprInput<SqlDate | SqlTimestamp | string>
): ExprRef<SqlFloat> {
  return fn<SqlFloat>("TO_UNIXTIME", value);
}

export function fromUnixTime(value: ExprInput<SqlNumber>): ExprRef<SqlTimestamp> {
  return fn<SqlTimestamp>("FROM_UNIXTIME", value);
}

export function year(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "year"), "INTEGER");
}

export function month(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "month"), "INTEGER");
}

export function day(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "day"), "INTEGER");
}

export function hour(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "hour"), "INTEGER");
}

export function minute(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "minute"), "INTEGER");
}

export function second(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return cast<SqlInt>(extract(value, "second"), "INTEGER");
}

export function toDate(value: ExprInput<SqlTimestamp>): ExprRef<SqlDate> {
  return cast<SqlDate>(value, "DATE");
}
