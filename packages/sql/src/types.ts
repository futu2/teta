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

export type SqlInt = number & { readonly [__sqlInt]: true };
export type SqlFloat = number & { readonly [__sqlFloat]: true };
export type SqlBigInt = bigint & { readonly [__sqlBigInt]: true };
export type SqlDecimal = number & { readonly [__sqlDecimal]: true };
export type SqlNumber = SqlInt | SqlFloat | SqlBigInt | SqlDecimal;
export type SqlDate = string & { readonly [__sqlDate]: true };
export type SqlTimestamp = string & { readonly [__sqlTimestamp]: true };
export type SqlUuid = string & { readonly [__sqlUuid]: true };
export type SqlBytes = Uint8Array & { readonly [__sqlBytes]: true };
export type SqlJson<T = unknown> = T & { readonly [__sqlJson]: true };

type ContextSqlNumber<TContext> = Extract<Exclude<TContext, null>, SqlNumber>;

export type NormalizeNumericLiteral<TContext, TValue> = TValue extends number | bigint
  ? [ContextSqlNumber<TContext>] extends [never]
    ? TValue
    : ContextSqlNumber<TContext>
  : TValue;

export type NormalizeNumericLiteralTuple<
  TContext,
  TValues extends readonly unknown[],
> = {
  [K in keyof TValues]: NormalizeNumericLiteral<TContext, TValues[K]>;
};

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

export type DialectFeatures = {
  lateralJoinKeyword?: boolean;
  recursiveCte?: boolean;
  qualifyClause?: boolean;
};

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

export type DialectLanguageConfig = {
  functions?: Record<string, string>;
  fallbacks?: Record<string, DialectLanguageFallback>;
  unsupported?: string[];
};

export type DialectSpec = {
  name: string;
  parserDialect?: string | null;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};

export type Dialect = BuiltinDialect | DialectSpec | (string & {});

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

export type SqlFormat = "compact" | "pretty";
export type SqlRenderStrategy = "optimized" | "readable";
export type SqlParameterMode = "inline" | "named" | "positional";
export type SqlParameterPrefix = ":" | "$" | "@";

export type SqlOptions = Option & {
  format?: SqlFormat;
  renderStrategy?: SqlRenderStrategy;
  dialect?: Dialect;
  parameterMode?: SqlParameterMode;
  parameterPrefix?: SqlParameterPrefix;
};

export type SqlParam = {
  /** Runtime value passed alongside the SQL string. */
  value: unknown;
  /** 1-based placeholder order, used by positional styles such as `$1`. */
  index: number;
  /** Placeholder name for named styles such as `:email`; null for positional styles. */
  name: string | null;
};

export type SqlResult = {
  sql: string;
  params: SqlParam[];
};
