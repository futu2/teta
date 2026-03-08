import type { Option } from "node-sql-parser";

declare const __sqlInt: unique symbol;
declare const __sqlFloat: unique symbol;

export type SqlInt = number & { readonly [__sqlInt]: true };
export type SqlFloat = number & { readonly [__sqlFloat]: true };
export type SqlNumber = SqlInt | SqlFloat;
export type SqlDate = string;
export type SqlTimestamp = string;

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
  };
  language: {
    functions: Record<string, string>;
    fallbacks: Record<string, DialectLanguageFallback>;
    unsupported: string[];
  };
};

export type SqlFormat = "compact" | "pretty";
export type SqlOptions = Option & { format?: SqlFormat; dialect?: Dialect };

export type SqlParam = {
  val: unknown;
  index: number;
  name: string | null;
};

export type SqlResult = {
  sql: string;
  params: SqlParam[];
};

export interface SqlRenderer<TInput = unknown, TResult extends SqlResult = SqlResult> {
  toSql(input: TInput): TResult;
}
