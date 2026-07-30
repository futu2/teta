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
  unsafeFn,
  funcExpr,
  toExprNode,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
} from "../core.ts";
import { assertSqlExtractField } from "@teta/sql";
import { cast } from "./math.ts";

type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableSqlNumber = SqlNumber | null;
type DateAddResult<TValue> =
  TValue extends null ? null
  : TValue extends SqlDate ? SqlDate
  : SqlTimestamp;
type DateTruncResult<TValue> =
  TValue extends null ? null
  : TValue extends SqlDate ? SqlDate
  : SqlTimestamp;

export function currentDate(): Expr<SqlDate> {
  return funcExpr("CURRENT_DATE", []);
}

export function currentTimestamp(): Expr<SqlTimestamp> {
  return funcExpr("CURRENT_TIMESTAMP", []);
}

export function dateLiteral(value: string): Expr<SqlDate> {
  return exprOf<SqlDate>({
    kind: "literal",
    value: { kind: "date_literal", value } as DateLiteral,
  });
}

export function timestampLiteral(value: string): Expr<SqlTimestamp> {
  return exprOf<SqlTimestamp>({
    kind: "literal",
    value: { kind: "timestamp_literal", value } as TimestampLiteral,
  });
}

export function extract<TValue>(value: ExprInput<TValue>, field: string): Expr<PropagateNull<TValue, SqlFloat>> {
  assertSqlExtractField(field);
  return exprOf<PropagateNull<TValue, SqlFloat>>({
    kind: "extract",
    field,
    source: toExprNode(value),
  });
}

export function dateTrunc<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>
): Expr<DateTruncResult<TValue>> {
  return unsafeFn<DateTruncResult<TValue>>("DATE_TRUNC", unit, value);
}

export function dateAdd<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>,
  amount: ExprInput<SqlInt>
): Expr<DateAddResult<TValue>> {
  return unsafeFn<DateAddResult<TValue>>("DATE_ADD", unit, amount, value);
}

export function dateDiff<
  TValue extends NullableDateLike,
  TOther extends NullableDateLike,
>(
  value: ExprInput<TValue>,
  unit: ExprInput<string>,
  other: ExprInput<TOther>
): Expr<PropagateNull<TValue | TOther, SqlInt>> {
  return unsafeFn<PropagateNull<TValue | TOther, SqlInt>>("DATE_DIFF", unit, value, other);
}

export function dateFormat<TValue extends NullableDateLike>(
  value: ExprInput<TValue>,
  format: ExprInput<string>
): Expr<PropagateNull<TValue, SqlString>> {
  return unsafeFn<PropagateNull<TValue, SqlString>>("DATE_FORMAT", value, format);
}

export function dateParse<TValue extends string | null>(
  value: ExprInput<TValue>,
  format: ExprInput<string>,
  resultType: "date"
): Expr<PropagateNull<TValue, SqlDate>>;
export function dateParse<TValue extends string | null>(
  value: ExprInput<TValue>,
  format: ExprInput<string>
): Expr<PropagateNull<TValue, SqlTimestamp>>;
export function dateParse<TValue extends string | null>(
  value: ExprInput<TValue>,
  format: ExprInput<string>,
  resultType?: "date"
): Expr<PropagateNull<TValue, SqlDate | SqlTimestamp>> {
  const parsed = unsafeFn<PropagateNull<TValue, SqlTimestamp>>("DATE_PARSE", value, format);
  return resultType === "date"
    ? asDate(parsed) as Expr<PropagateNull<TValue, SqlDate | SqlTimestamp>>
    : parsed;
}

export function toUnixTime<TValue extends NullableDateLike>(
  value: ExprInput<TValue>
): Expr<PropagateNull<TValue, SqlFloat>> {
  return unsafeFn<PropagateNull<TValue, SqlFloat>>("TO_UNIXTIME", value);
}

export function fromUnixTime<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): Expr<PropagateNull<TValue, SqlTimestamp>> {
  return unsafeFn<PropagateNull<TValue, SqlTimestamp>>("FROM_UNIXTIME", value);
}

export function year<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "year"), "INTEGER");
}

export function month<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "month"), "INTEGER");
}

export function day<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "day"), "INTEGER");
}

export function dayOfWeek<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return unsafeFn<PropagateNull<TValue, SqlInt>>("day_of_week", value);
}

export function hour<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "hour"), "INTEGER");
}

export function minute<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "minute"), "INTEGER");
}

export function second<TValue>(value: ExprInput<TValue>): Expr<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(extract(value, "second"), "INTEGER");
}

export function asDate<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlDate>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlDate>, TInput>(value, "DATE");
}

export function asTimestamp<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlTimestamp>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlTimestamp>, TInput>(value, "TIMESTAMP");
}
