import { type ExprInput, type ExprRef, type PropagateNull } from "../../../core/expr";
import type { SqlInt } from "../../types";
import {
  bitLength,
  charLength,
  characterLength,
  concat,
  left,
  lower,
  lpad,
  octetLength,
  overlay,
  position,
  regexExtract,
  regexLike,
  regexReplace,
  replace,
  reverse,
  right,
  rpad,
  substring,
  trim,
  upper,
} from "../ops/string";
import { defineExprMethods } from "./shared";

type NullableString = string | null;

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    replace<TValue extends NullableString>(this: ExprRef<TValue>, search: ExprInput<string>, replacement: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
    upper<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
    lower<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
    reverse<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
    trim<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
    regexLike(this: ExprRef<NullableString>, pattern: ExprInput<string>): ExprRef<boolean>;
    regexReplace<TValue extends NullableString>(this: ExprRef<TValue>, pattern: ExprInput<string>, replacement: ExprInput<string>, flags?: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
    regexExtract<TValue extends NullableString>(this: ExprRef<TValue>, pattern: ExprInput<string>, groupIndex?: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
    substring<TValue extends NullableString>(this: ExprRef<TValue>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
    position<TValue extends NullableString>(this: ExprRef<TValue>, needle: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlInt>>;
    overlay<TValue extends NullableString>(this: ExprRef<TValue>, placing: ExprInput<string>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
    charLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    characterLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    octetLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    bitLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
    left<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
    right<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
    lpad<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>, padding?: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
    rpad<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>, padding?: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
    concat<TValue extends NullableString>(this: ExprRef<TValue>, ...parts: ExprInput<unknown>[]): ExprRef<PropagateNull<TValue, string>>;
  }
}

defineExprMethods([
  ["replace", replace],
  ["upper", upper],
  ["lower", lower],
  ["reverse", reverse],
  ["trim", trim],
  ["regexLike", regexLike],
  ["regexReplace", regexReplace],
  ["regexExtract", regexExtract],
  ["substring", substring],
  ["position", position],
  ["overlay", overlay],
  ["charLength", charLength],
  ["characterLength", characterLength],
  ["octetLength", octetLength],
  ["bitLength", bitLength],
  ["left", left],
  ["right", right],
  ["lpad", lpad],
  ["rpad", rpad],
  ["concat", concat],
]);
