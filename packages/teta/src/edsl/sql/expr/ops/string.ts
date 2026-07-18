import type { SqlBoolean, SqlInt, SqlString } from "../../types.ts";
import {
  fn,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
} from "../core.ts";

type NullableString = string | null;
type SqlStringResult<TInput> = PropagateNull<ExprInputValue<TInput>, SqlString>;
type SqlBooleanResult<TInput> = PropagateNull<ExprInputValue<TInput>, SqlBoolean>;

export function replace<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TSearch extends ExprInput<string>,
  TReplacement extends ExprInput<string>,
>(
  value: TInput,
  search: TSearch,
  replacement: TReplacement
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput, TSearch, TReplacement]>(
    "REPLACE",
    value,
    search,
    replacement
  );
}

export function upper<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput]>("UPPER", value);
}

export function lower<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput]>("LOWER", value);
}

export function reverse<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput]>("REVERSE", value);
}

export function trim<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput]>("TRIM", value);
}

export function regexLike<
  TInput extends ExprInput<NullableString>,
  TPattern extends ExprInput<string>,
>(
  value: TInput,
  pattern: TPattern
): Expr<SqlBooleanResult<TInput>> {
  return fn<SqlBooleanResult<TInput>, [TInput, TPattern]>(
    "REGEXP_LIKE",
    value,
    pattern
  );
}

export function regexReplace<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TPattern extends ExprInput<string>,
  TReplacement extends ExprInput<string>,
  TFlags extends ExprInput<string> | undefined = undefined,
>(
  value: TInput,
  pattern: TPattern,
  replacement: TReplacement,
  flags?: TFlags
): Expr<SqlStringResult<TInput>> {
  if (flags === undefined) {
    return fn<SqlStringResult<TInput>, [TInput, TPattern, TReplacement]>(
      "REGEXP_REPLACE",
      value,
      pattern,
      replacement
    );
  }
  return fn<SqlStringResult<TInput>, [TInput, TPattern, TReplacement, NonNullable<TFlags>]>(
    "REGEXP_REPLACE",
    value,
    pattern,
    replacement,
    flags as NonNullable<TFlags>
  );
}

export function regexExtract<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TPattern extends ExprInput<string>,
  TGroupIndex extends ExprInput<SqlInt> | undefined = undefined,
>(
  value: TInput,
  pattern: TPattern,
  groupIndex?: TGroupIndex
): Expr<SqlStringResult<TInput>> {
  if (groupIndex === undefined) {
    return fn<SqlStringResult<TInput>, [TInput, TPattern]>(
      "REGEXP_EXTRACT",
      value,
      pattern
    );
  }
  return fn<SqlStringResult<TInput>, [TInput, TPattern, NonNullable<TGroupIndex>]>(
    "REGEXP_EXTRACT",
    value,
    pattern,
    groupIndex as NonNullable<TGroupIndex>
  );
}

export function substring<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TStart extends ExprInput<SqlInt>,
  TLength extends ExprInput<SqlInt> | undefined = undefined,
>(
  value: TInput,
  start: TStart,
  length?: TLength
): Expr<SqlStringResult<TInput>> {
  if (length === undefined) {
    return fn<SqlStringResult<TInput>, [TInput, TStart]>(
      "SUBSTRING",
      value,
      start
    );
  }
  return fn<SqlStringResult<TInput>, [TInput, TStart, NonNullable<TLength>]>(
    "SUBSTRING",
    value,
    start,
    length as NonNullable<TLength>
  );
}

export function position<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TNeedle extends ExprInput<string>,
>(
  value: TInput,
  needle: TNeedle
): Expr<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TNeedle, TInput]>("POSITION", needle, value);
}

export function overlay<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TPlacing extends ExprInput<string>,
  TStart extends ExprInput<SqlInt>,
  TLength extends ExprInput<SqlInt> | undefined = undefined,
>(
  value: TInput,
  placing: TPlacing,
  start: TStart,
  length?: TLength
): Expr<SqlStringResult<TInput>> {
  if (length === undefined) {
    return fn<SqlStringResult<TInput>, [TInput, TPlacing, TStart]>(
      "OVERLAY",
      value,
      placing,
      start
    );
  }
  return fn<SqlStringResult<TInput>, [TInput, TPlacing, TStart, NonNullable<TLength>]>(
    "OVERLAY",
    value,
    placing,
    start,
    length as NonNullable<TLength>
  );
}

export function charLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CHAR_LENGTH", value);
}

export function characterLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CHARACTER_LENGTH", value);
}

export function octetLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("OCTET_LENGTH", value);
}

export function bitLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("BIT_LENGTH", value);
}

export function leftSubstring<
  TInput extends ExprInput<NullableString>,
  TLength extends ExprInput<SqlInt>,
>(
  value: TInput,
  length: TLength
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput, TLength]>("LEFT", value, length);
}

export function rightSubstring<
  TInput extends ExprInput<NullableString>,
  TLength extends ExprInput<SqlInt>,
>(
  value: TInput,
  length: TLength
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput, TLength]>("RIGHT", value, length);
}

export function lpad<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TLength extends ExprInput<SqlInt>,
  TPadding extends ExprInput<string> = " ",
>(
  value: TInput,
  length: TLength,
  padding: TPadding = " " as TPadding
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput, TLength, TPadding]>(
    "LPAD",
    value,
    length,
    padding
  );
}

export function rpad<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TLength extends ExprInput<SqlInt>,
  TPadding extends ExprInput<string> = " ",
>(
  value: TInput,
  length: TLength,
  padding: TPadding = " " as TPadding
): Expr<SqlStringResult<TInput>> {
  return fn<SqlStringResult<TInput>, [TInput, TLength, TPadding]>(
    "RPAD",
    value,
    length,
    padding
  );
}

export function concat<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  const TParts extends readonly ExprInput<unknown>[],
>(
  value: TInput,
  ...parts: TParts
): Expr<SqlStringResult<TInput>> {
  if (parts.length === 0) {
    return wrapExpr(value) as Expr<SqlStringResult<TInput>>;
  }
  return fn<SqlStringResult<TInput>, [TInput, ...TParts]>("CONCAT", value, ...parts);
}
