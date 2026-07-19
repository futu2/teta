import type { SqlBoolean, SqlInt, SqlString } from "../../types.ts";
import {
  unsafeFn,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
} from "../core.ts";

export function arrayLength(value: ExprInput<unknown>): Expr<SqlInt> {
  return unsafeFn<SqlInt>("ARRAY_LENGTH", value);
}

export function arrayContains<TInput extends ExprInput<unknown>, TItem extends ExprInput<unknown>>(
  value: TInput,
  item: TItem
): Expr<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TItem>, SqlBoolean>> {
  return unsafeFn<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TItem>, SqlBoolean>>(
    "ARRAY_CONTAINS",
    value,
    item
  );
}

export function arrayPosition(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<SqlInt> {
  return unsafeFn<SqlInt>("ARRAY_POSITION", value, item);
}

export function arraySlice(
  value: ExprInput<unknown>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): Expr<unknown> {
  const args: ExprInput<unknown>[] = [value, start];
  if (length !== undefined) args.push(length);
  return unsafeFn<unknown>("ARRAY_SLICE", ...args);
}

export function arrayJoin(
  value: ExprInput<unknown>,
  separator: ExprInput<string>
): Expr<SqlString> {
  return unsafeFn<SqlString>("ARRAY_JOIN", value, separator);
}

export function arrayAppend(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<unknown> {
  return unsafeFn<unknown>("ARRAY_APPEND", value, item);
}

export function arrayPrepend(
  value: ExprInput<unknown>,
  item: ExprInput<unknown>
): Expr<unknown> {
  return unsafeFn<unknown>("ARRAY_PREPEND", value, item);
}

export function arrayConcat(
  value: ExprInput<unknown>,
  ...values: ExprInput<unknown>[]
): Expr<unknown> {
  if (values.length === 0) return wrapExpr(value);
  return unsafeFn<unknown>("ARRAY_CONCAT", value, ...values);
}

export function arrayDistinct(value: ExprInput<unknown>): Expr<unknown> {
  return unsafeFn<unknown>("ARRAY_DISTINCT", value);
}
