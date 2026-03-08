import type { SqlInt } from "../../types";
import { fn, wrapExpr, type ExprInput, type ExprRef, type PropagateNull } from "../core";

type NullableString = string | null;

export function replace<TValue extends NullableString>(
  value: ExprInput<TValue>,
  search: ExprInput<string>,
  replacement: ExprInput<string>
): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("REPLACE", value, search, replacement);
}

export function upper<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("UPPER", value);
}

export function lower<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("LOWER", value);
}

export function reverse<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("REVERSE", value);
}

export function trim<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("TRIM", value);
}

export function regexLike(
  value: ExprInput<NullableString>,
  pattern: ExprInput<string>
): ExprRef<boolean> {
  return fn<boolean>("REGEXP_LIKE", value, pattern);
}

export function regexReplace<TValue extends NullableString>(
  value: ExprInput<TValue>,
  pattern: ExprInput<string>,
  replacement: ExprInput<string>,
  flags?: ExprInput<string>
): ExprRef<PropagateNull<TValue, string>> {
  const args: ExprInput<unknown>[] = [value, pattern, replacement];
  if (flags !== undefined) args.push(flags);
  return fn<PropagateNull<TValue, string>>("REGEXP_REPLACE", ...args);
}

export function regexExtract<TValue extends NullableString>(
  value: ExprInput<TValue>,
  pattern: ExprInput<string>,
  groupIndex?: ExprInput<SqlInt>
): ExprRef<PropagateNull<TValue, string>> {
  const args: ExprInput<unknown>[] = [value, pattern];
  if (groupIndex !== undefined) args.push(groupIndex);
  return fn<PropagateNull<TValue, string>>("REGEXP_EXTRACT", ...args);
}

export function substring<TValue extends NullableString>(
  value: ExprInput<TValue>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<PropagateNull<TValue, string>> {
  const args: ExprInput<unknown>[] = [value, start];
  if (length !== undefined) args.push(length);
  return fn<PropagateNull<TValue, string>>("SUBSTRING", ...args);
}

export function position<TValue extends NullableString>(
  value: ExprInput<TValue>,
  needle: ExprInput<string>
): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("POSITION", needle, value);
}

export function overlay<TValue extends NullableString>(
  value: ExprInput<TValue>,
  placing: ExprInput<string>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<PropagateNull<TValue, string>> {
  const args: ExprInput<unknown>[] = [value, placing, start];
  if (length !== undefined) args.push(length);
  return fn<PropagateNull<TValue, string>>("OVERLAY", ...args);
}

export function charLength<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("CHAR_LENGTH", value);
}

export function characterLength<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("CHARACTER_LENGTH", value);
}

export function octetLength<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("OCTET_LENGTH", value);
}

export function bitLength<TValue extends NullableString>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("BIT_LENGTH", value);
}

export function left<TValue extends NullableString>(value: ExprInput<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("LEFT", value, length);
}

export function right<TValue extends NullableString>(value: ExprInput<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("RIGHT", value, length);
}

export function lpad<TValue extends NullableString>(
  value: ExprInput<TValue>,
  length: ExprInput<SqlInt>,
  padding: ExprInput<string> = " "
): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("LPAD", value, length, padding);
}

export function rpad<TValue extends NullableString>(
  value: ExprInput<TValue>,
  length: ExprInput<SqlInt>,
  padding: ExprInput<string> = " "
): ExprRef<PropagateNull<TValue, string>> {
  return fn<PropagateNull<TValue, string>>("RPAD", value, length, padding);
}

export function concat<TValue extends NullableString>(
  value: ExprInput<TValue>,
  ...parts: ExprInput<unknown>[]
): ExprRef<PropagateNull<TValue, string>> {
  if (parts.length === 0) return wrapExpr(value) as ExprRef<PropagateNull<TValue, string>>;
  return fn<PropagateNull<TValue, string>>("CONCAT", value, ...parts);
}
