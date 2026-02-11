/**
 * Type-safe SQL EDSL with composable query pipelines.
 * @module
 */

/** Main query builder type returned by `table(...)`. */
export { Query, table, loop, t } from "./src/edsl/query";

/** Expression builder and helpers for composing SQL expressions. */
export {
  ExprRef,
  fn,
  windowFn,
  when,
  shape,
  f,
  lit,
  currentDate,
  currentTimestamp,
  dateLiteral,
  timestampLiteral,
} from "./src/edsl/expr";

/** Language specification and dialect mapping helpers. */
export { LANGUAGE_SPEC, getLanguageSpec } from "./src/edsl/language";
export type { LanguageCategory } from "./src/edsl/language";

/** Common SQL type aliases and SQL rendering options. */
export type {
  BuiltinDialect,
  DialectLanguageConfig,
  DialectLanguageFallback,
  DialectFeatures,
  DialectSpec,
  QueryDialect,
  SqlInt,
  SqlFloat,
  SqlNumber,
  SqlDate,
  SqlTimestamp,
  Dialect,
  SqlFormat,
  SqlOptions,
} from "./src/edsl/types";
