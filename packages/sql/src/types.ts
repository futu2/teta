import type { Option, Parser } from "node-sql-parser";

declare const __sqlInt: unique symbol;
declare const __sqlFloat: unique symbol;
declare const __sqlBigInt: unique symbol;
declare const __sqlDecimal: unique symbol;
declare const __sqlDate: unique symbol;
declare const __sqlTimestamp: unique symbol;
declare const __sqlUuid: unique symbol;
declare const __sqlBytes: unique symbol;
declare const __sqlJson: unique symbol;

/** Branded SQL integer value. */
export type SqlInt = number & { readonly [__sqlInt]: true };
/** Branded SQL floating-point value. */
export type SqlFloat = number & { readonly [__sqlFloat]: true };
/** Branded SQL bigint value. */
export type SqlBigInt = bigint & { readonly [__sqlBigInt]: true };
/** Branded SQL decimal value. */
export type SqlDecimal = number & { readonly [__sqlDecimal]: true };
/** Union of numeric SQL-branded values. */
export type SqlNumber = SqlInt | SqlFloat | SqlBigInt | SqlDecimal;
/** Branded SQL date value. */
export type SqlDate = string & { readonly [__sqlDate]: true };
/** Branded SQL timestamp value. */
export type SqlTimestamp = string & { readonly [__sqlTimestamp]: true };
/** Branded SQL UUID value. */
export type SqlUuid = string & { readonly [__sqlUuid]: true };
/** Branded SQL bytes/blob value. */
export type SqlBytes = Uint8Array & { readonly [__sqlBytes]: true };
/** Branded SQL JSON value preserving the JSON payload type. */
export type SqlJson<T = unknown> = T & { readonly [__sqlJson]: true };

type ContextSqlNumber<TContext> = Extract<Exclude<TContext, null>, SqlNumber>;

/** Normalize a numeric literal against a SQL numeric context type. */
export type NormalizeNumericLiteral<TContext, TValue> = TValue extends number | bigint
  ? [ContextSqlNumber<TContext>] extends [never]
    ? TValue
    : ContextSqlNumber<TContext>
  : TValue;

/** Normalize a tuple of numeric literal values against a SQL numeric context type. */
export type NormalizeNumericLiteralTuple<
  TContext,
  TValues extends readonly unknown[],
> = {
  [K in keyof TValues]: NormalizeNumericLiteral<TContext, TValues[K]>;
};

/** Normalize TypeScript literal values to their corresponding SQL expression value types. */
export type NormalizeExpressionLiteral<TValue> =
  TValue extends SqlNumber | SqlDate | SqlTimestamp | SqlUuid | SqlBytes
    ? TValue
  : TValue extends number
    ? number extends TValue
      ? TValue
      : SqlNumber
  : TValue extends bigint
    ? bigint extends TValue
      ? TValue
      : SqlBigInt
  : TValue extends string
    ? string extends TValue
      ? TValue
      : string
  : TValue extends boolean
    ? boolean
  : TValue;

/** Canonical built-in dialect names supported by the renderer. */
export type BuiltinDialect =
  | "mysql"
  | "mariadb"
  | "postgresql"
  | "sqlite"
  | "trino"
  | "transactsql"
  | "redshift"
  | "snowflake"
  | "bigquery"
  | "athena"
  | "db2"
  | "hive"
  | "flinksql"
  | "noql"
  | "duckdb"
  | "hetu";

/** Optional feature flags that affect dialect-specific SQL lowering. */
export type DialectFeatures = {
  lateralJoinKeyword?: boolean;
  recursiveCte?: boolean;
  qualifyClause?: boolean;
};

/** Named fallback rewrite used when a dialect lacks a function directly. */
export type DialectLanguageFallback =
  | "bit_length_via_length_x8"
  | "array_length_via_json_array_length"
  | "array_length_dim1"
  | "array_slice_via_start_length"
  | "array_contains_via_array_position"
  | "array_contains_via_json_instr"
  | "array_position_via_json_instr"
  | "array_join_via_json_string"
  | "array_append_via_json_insert_end"
  | "array_append_via_concat_operator"
  | "array_prepend_via_concat_operator"
  | "array_prepend_via_list_concat"
  | "position_via_instr"
  | "overlay_via_concat_substring"
  | "cast_date_via_date_function"
  | "extract_via_strftime"
  | "date_format_via_strftime"
  | "date_parse_via_datetime"
  | "date_trunc_via_strftime"
  | "date_add_via_datetime"
  | "date_diff_via_julianday"
  | "date_diff_via_extract_epoch"
  | "date_add_via_epoch_timestamp"
  | "date_add_via_hive_datetime"
  | "to_unixtime_via_strftime_s"
  | "to_unixtime_via_extract_epoch"
  | "from_unixtime_via_datetime"
  | "regex_like_via_regexp_match"
  | "regex_like_via_regexp_function";

/** Function names, fallback rewrites, and unsupported functions for a dialect. */
export type DialectLanguageConfig = {
  functions?: Record<string, string>;
  fallbacks?: Record<string, DialectLanguageFallback>;
  unsupported?: string[];
};

/** User-provided dialect specification for custom SQL dialect behavior. */
export type DialectSpec = {
  name: string;
  parserDialect?: string | null;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};

/** Dialect input accepted by renderer options. */
export type Dialect = BuiltinDialect | DialectSpec | (string & {});

/** Fully resolved dialect metadata used by the renderer. */
export type QueryDialect = {
  name: string;
  parserDialect: string | null;
  features: {
    lateralJoinKeyword: boolean;
    recursiveCte: boolean;
    qualifyClause: boolean;
  };
  language: {
    functions: Record<string, string>;
    fallbacks: Record<string, DialectLanguageFallback>;
    unsupported: string[];
  };
};

/** SQL string formatting mode. */
export type SqlFormat = "compact" | "pretty";
/** Query-stage lowering strategy. */
export type SqlRenderStrategy = "optimized" | "readable";
/** Parameter placeholder rendering mode. */
export type SqlParameterMode = "inline" | "named" | "positional";
/** Placeholder prefix for named or positional parameters. */
export type SqlParameterPrefix = ":" | "$" | "@";

/** Rendering options accepted by query and expression SQL helpers. */
export type SqlOptions = Option & {
  format?: SqlFormat;
  renderStrategy?: SqlRenderStrategy;
  dialect?: Dialect;
  parameterMode?: SqlParameterMode;
  parameterPrefix?: SqlParameterPrefix;
};

/** One bound parameter produced by parameterized rendering. */
export type SqlParam = {
  /** Runtime value passed alongside the SQL string. */
  value: unknown;
  /** 1-based placeholder order, used by positional styles such as `$1`. */
  index: number;
  /** Placeholder name for named styles such as `:email`; null for positional styles. */
  name: string | null;
};

/** Rendered SQL plus any bound parameter metadata. */
export type SqlResult = {
  sql: string;
  params: SqlParam[];
};
