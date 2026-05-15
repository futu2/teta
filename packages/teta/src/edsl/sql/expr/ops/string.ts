import type { SqlInt } from "../../types.ts";
import {
  fn,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type ExprRef,
  type PropagateNull,
} from "../core.ts";

type NullableString = string | null;

export function replace<
  TValue extends NullableString,
  TInput extends ExprInput<TValue>,
  TSearch extends ExprInput<string>,
  TReplacement extends ExprInput<string>,
>(
  value: TInput,
  search: TSearch,
  replacement: TReplacement
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TSearch, TReplacement]>(
    "REPLACE",
    value,
    search,
    replacement
  );
}

export function upper<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput]>("UPPER", value);
}

export function lower<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput]>("LOWER", value);
}

export function reverse<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput]>("REVERSE", value);
}

export function trim<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput]>("TRIM", value);
}

export function regexLike<
  TInput extends ExprInput<NullableString>,
  TPattern extends ExprInput<string>,
>(
  value: TInput,
  pattern: TPattern
): ExprRef<boolean> {
  return fn<boolean, [TInput, TPattern]>("REGEXP_LIKE", value, pattern);
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  if (flags === undefined) {
    return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPattern, TReplacement]>(
      "REGEXP_REPLACE",
      value,
      pattern,
      replacement
    );
  }
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPattern, TReplacement, NonNullable<TFlags>]>(
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  if (groupIndex === undefined) {
    return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPattern]>(
      "REGEXP_EXTRACT",
      value,
      pattern
    );
  }
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPattern, NonNullable<TGroupIndex>]>(
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  if (length === undefined) {
    return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TStart]>(
      "SUBSTRING",
      value,
      start
    );
  }
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TStart, NonNullable<TLength>]>(
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  if (length === undefined) {
    return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPlacing, TStart]>(
      "OVERLAY",
      value,
      placing,
      start
    );
  }
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TPlacing, TStart, NonNullable<TLength>]>(
    "OVERLAY",
    value,
    placing,
    start,
    length as NonNullable<TLength>
  );
}

export function charLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CHAR_LENGTH", value);
}

export function characterLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CHARACTER_LENGTH", value);
}

export function octetLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("OCTET_LENGTH", value);
}

export function bitLength<TInput extends ExprInput<NullableString>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("BIT_LENGTH", value);
}

export function left<
  TInput extends ExprInput<NullableString>,
  TLength extends ExprInput<SqlInt>,
>(
  value: TInput,
  length: TLength
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TLength]>("LEFT", value, length);
}

export function right<
  TInput extends ExprInput<NullableString>,
  TLength extends ExprInput<SqlInt>,
>(
  value: TInput,
  length: TLength
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TLength]>("RIGHT", value, length);
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TLength, TPadding]>(
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, TLength, TPadding]>(
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
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  if (parts.length === 0) {
    return wrapExpr(value) as ExprRef<PropagateNull<ExprInputValue<TInput>, string>>;
  }
  return fn<PropagateNull<ExprInputValue<TInput>, string>, [TInput, ...TParts]>("CONCAT", value, ...parts);
}
