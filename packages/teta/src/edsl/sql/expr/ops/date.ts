import type { DateLiteral, TimestampLiteral } from "../../../core/types.ts";
import type {
  SqlDate,
  SqlFloat,
  SqlInt,
  SqlNumber,
  SqlString,
  SqlTimestamp,
} from "../../types.ts";
import {
  exprOf,
  fn,
  funcExpr,
  toExprNode,
  type ExprInput,
  type ExprRef,
  type PropagateNull,
} from "../core.ts";
import { userError } from "../../../errors.ts";
import { cast } from "./math.ts";

type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableTimestamp = SqlTimestamp | null;
type NullableTimestampCast = SqlDate | SqlTimestamp | null;
type NullableSqlNumber = SqlNumber | null;

export function currentDate(): ExprRef<SqlDate> {
  return funcExpr("CURRENT_DATE", []);
}

export function currentTimestamp(): ExprRef<SqlTimestamp> {
  return funcExpr("CURRENT_TIMESTAMP", []);
}

export function dateLiteral(value: string): ExprRef<SqlDate> {
  return exprOf<SqlDate>({
    kind: "literal",
    value: { kind: "date_literal", value } as DateLiteral,
  });
}

export function timestampLiteral(value: string): ExprRef<SqlTimestamp> {
  return exprOf<SqlTimestamp>({
    kind: "literal",
    value: { kind: "timestamp_literal", value } as TimestampLiteral,
  });
}

export function extract<TValue>(value: ExprInput<TValue>, field: string): ExprRef<PropagateNull<TValue, SqlFloat>> {
  if (!field.trim()) {
    userError("INVALID_FUNCTION_NAME", "extract requires a field");
  }
  return exprOf<PropagateNull<TValue, SqlFloat>>({
    kind: "extract",
    field,
    source: toExprNode(value),
  });
}

export function dateTrunc<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>
): ExprRef<PropagateNull<TValue, SqlTimestamp>> {
  return fn<PropagateNull<TValue, SqlTimestamp>>("DATE_TRUNC", unit, value);
}

export function dateAdd<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>,
  amount: ExprInput<SqlInt>
): ExprRef<PropagateNull<TValue, SqlTimestamp>> {
  return fn<PropagateNull<TValue, SqlTimestamp>>("DATE_ADD", unit, amount, value);
}

export function dateDiff<
  TValue extends NullableDateLike,
  TOther extends NullableDateLike,
>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>,
  other: ExprInput<TOther>
): ExprRef<PropagateNull<TValue | TOther, SqlInt>> {
  return fn<PropagateNull<TValue | TOther, SqlInt>>("DATE_DIFF", unit, value, other);
}

export function dateFormat<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  format: ExprInput<string>
): ExprRef<PropagateNull<TValue, SqlString>> {
  return fn<PropagateNull<TValue, SqlString>>("DATE_FORMAT", value, format);
}

export function dateParse<TValue extends string | null>(
  value: ExprInput<TValue>,
  format: ExprInput<string>
): ExprRef<PropagateNull<TValue, SqlTimestamp>> {
  return fn<PropagateNull<TValue, SqlTimestamp>>("DATE_PARSE", value, format);
}

export function toUnixTime<TValue extends NullableDateLike>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlFloat>> {
  return fn<PropagateNull<TValue, SqlFloat>>("TO_UNIXTIME", value);
}

export function fromUnixTime<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlTimestamp>> {
  return fn<PropagateNull<TValue, SqlTimestamp>>("FROM_UNIXTIME", value);
}

export function year<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "year"), "INTEGER");
}

export function month<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "month"), "INTEGER");
}

export function day<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "day"), "INTEGER");
}

export function hour<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "hour"), "INTEGER");
}

export function minute<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "minute"), "INTEGER");
}

export function second<TValue>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "second"), "INTEGER");
}

export function toDate<TValue extends NullableTimestamp>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlDate>> {
  return cast<PropagateNull<TValue, SqlDate>>(value, "DATE");
}

export function toTimestamp<TValue extends NullableTimestampCast>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlTimestamp>> {
  return cast<PropagateNull<TValue, SqlTimestamp>>(value, "TIMESTAMP");
}
