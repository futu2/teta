import { type ExprInput, type ExprRef } from "../../../core/expr";
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

declare module "../../../core/expr/core" {
  interface ExprRef<T> {
    replace(this: ExprRef<string>, search: ExprInput<string>, replacement: ExprInput<string>): ExprRef<string>;
    upper(this: ExprRef<string>): ExprRef<string>;
    lower(this: ExprRef<string>): ExprRef<string>;
    reverse(this: ExprRef<string>): ExprRef<string>;
    trim(this: ExprRef<string>): ExprRef<string>;
    regexLike(this: ExprRef<string>, pattern: ExprInput<string>): ExprRef<boolean>;
    regexReplace(this: ExprRef<string>, pattern: ExprInput<string>, replacement: ExprInput<string>, flags?: ExprInput<string>): ExprRef<string>;
    regexExtract(this: ExprRef<string>, pattern: ExprInput<string>, groupIndex?: ExprInput<SqlInt>): ExprRef<string>;
    substring(this: ExprRef<string>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<string>;
    position(this: ExprRef<string>, needle: ExprInput<string>): ExprRef<SqlInt>;
    overlay(this: ExprRef<string>, placing: ExprInput<string>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<string>;
    charLength(this: ExprRef<string>): ExprRef<SqlInt>;
    characterLength(this: ExprRef<string>): ExprRef<SqlInt>;
    octetLength(this: ExprRef<string>): ExprRef<SqlInt>;
    bitLength(this: ExprRef<string>): ExprRef<SqlInt>;
    left(this: ExprRef<string>, length: ExprInput<SqlInt>): ExprRef<string>;
    right(this: ExprRef<string>, length: ExprInput<SqlInt>): ExprRef<string>;
    lpad(this: ExprRef<string>, length: ExprInput<SqlInt>, padding?: ExprInput<string>): ExprRef<string>;
    rpad(this: ExprRef<string>, length: ExprInput<SqlInt>, padding?: ExprInput<string>): ExprRef<string>;
    concat(this: ExprRef<string>, ...parts: ExprInput<unknown>[]): ExprRef<string>;
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

