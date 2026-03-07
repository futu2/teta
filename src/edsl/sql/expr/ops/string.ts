import type { SqlInt } from "../../types";
import { ExprRef, fn, wrapExpr, type ExprInput } from "../core";

export function replace(
  value: ExprInput<string>,
  search: ExprInput<string>,
  replacement: ExprInput<string>
): ExprRef<string> {
  return fn<string>("REPLACE", value, search, replacement);
}

export function upper(value: ExprInput<string>): ExprRef<string> {
  return fn<string>("UPPER", value);
}

export function lower(value: ExprInput<string>): ExprRef<string> {
  return fn<string>("LOWER", value);
}

export function reverse(value: ExprInput<string>): ExprRef<string> {
  return fn<string>("REVERSE", value);
}

export function trim(value: ExprInput<string>): ExprRef<string> {
  return fn<string>("TRIM", value);
}

export function regexLike(
  value: ExprInput<string>,
  pattern: ExprInput<string>
): ExprRef<boolean> {
  return fn<boolean>("REGEXP_LIKE", value, pattern);
}

export function regexReplace(
  value: ExprInput<string>,
  pattern: ExprInput<string>,
  replacement: ExprInput<string>,
  flags?: ExprInput<string>
): ExprRef<string> {
  const args: ExprInput<unknown>[] = [value, pattern, replacement];
  if (flags !== undefined) args.push(flags);
  return fn<string>("REGEXP_REPLACE", ...args);
}

export function regexExtract(
  value: ExprInput<string>,
  pattern: ExprInput<string>,
  groupIndex?: ExprInput<SqlInt>
): ExprRef<string> {
  const args: ExprInput<unknown>[] = [value, pattern];
  if (groupIndex !== undefined) args.push(groupIndex);
  return fn<string>("REGEXP_EXTRACT", ...args);
}

export function substring(
  value: ExprInput<string>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<string> {
  const args: ExprInput<unknown>[] = [value, start];
  if (length !== undefined) args.push(length);
  return fn<string>("SUBSTRING", ...args);
}

export function position(
  value: ExprInput<string>,
  needle: ExprInput<string>
): ExprRef<SqlInt> {
  return fn<SqlInt>("POSITION", needle, value);
}

export function overlay(
  value: ExprInput<string>,
  placing: ExprInput<string>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<string> {
  const args: ExprInput<unknown>[] = [value, placing, start];
  if (length !== undefined) args.push(length);
  return fn<string>("OVERLAY", ...args);
}

export function charLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return fn<SqlInt>("CHAR_LENGTH", value);
}

export function characterLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return fn<SqlInt>("CHARACTER_LENGTH", value);
}

export function octetLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return fn<SqlInt>("OCTET_LENGTH", value);
}

export function bitLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return fn<SqlInt>("BIT_LENGTH", value);
}

export function left(value: ExprInput<string>, length: ExprInput<SqlInt>): ExprRef<string> {
  return fn<string>("LEFT", value, length);
}

export function right(value: ExprInput<string>, length: ExprInput<SqlInt>): ExprRef<string> {
  return fn<string>("RIGHT", value, length);
}

export function lpad(
  value: ExprInput<string>,
  length: ExprInput<SqlInt>,
  padding: ExprInput<string> = " "
): ExprRef<string> {
  return fn<string>("LPAD", value, length, padding);
}

export function rpad(
  value: ExprInput<string>,
  length: ExprInput<SqlInt>,
  padding: ExprInput<string> = " "
): ExprRef<string> {
  return fn<string>("RPAD", value, length, padding);
}

export function concat(
  value: ExprInput<string>,
  ...parts: ExprInput<unknown>[]
): ExprRef<string> {
  if (parts.length === 0) return wrapExpr(value);
  return fn<string>("CONCAT", value, ...parts);
}
