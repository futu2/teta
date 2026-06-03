import type { SqlBoolean, SqlInt, SqlString } from "../../types.ts";
import {
  fn,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
} from "../core.ts";

export function arrayLength(value: ExprInput<unknown>): Expr<SqlInt> {
  return fn<SqlInt>("ARRAY_LENGTH", value);
}

export function arrayContains<TInput extends ExprInput<unknown>, TItem extends ExprInput<unknown>>(
  value: TInput,
  item: TItem
): Expr<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TItem>, SqlBoolean>> {
  return fn<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TItem>, SqlBoolean>>(
    "ARRAY_CONTAINS",
    value,
    item
  );
}

export function arrayPosition(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<SqlInt> {
  return fn<SqlInt>("ARRAY_POSITION", value, item);
}

export function arraySlice(
  value: ExprInput<unknown>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): Expr<unknown> {
  const args: ExprInput<unknown>[] = [value, start];
  if (length !== undefined) args.push(length);
  return fn<unknown>("ARRAY_SLICE", ...args);
}

export function arrayJoin(
  value: ExprInput<unknown>,
  separator: ExprInput<string>
): Expr<SqlString> {
  return fn<SqlString>("ARRAY_JOIN", value, separator);
}

export function arrayAppend(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<unknown> {
  return fn<unknown>("ARRAY_APPEND", value, item);
}

export function arrayPrepend(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<unknown> {
  return fn<unknown>("ARRAY_PREPEND", value, item);
}

export function arrayConcat(
  value: ExprInput<unknown>,
  ...values: ExprInput<unknown>[]
): Expr<unknown> {
  if (values.length === 0) return wrapExpr(value);
  return fn<unknown>("ARRAY_CONCAT", value, ...values);
}

export function arrayDistinct(value: ExprInput<unknown>): Expr<unknown> {
  return fn<unknown>("ARRAY_DISTINCT", value);
}
