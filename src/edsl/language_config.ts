import type { DialectLanguageConfig } from "./types";

const IDENTITY_LANGUAGE: Required<DialectLanguageConfig> = {
  functions: {},
  fallbacks: {},
  unsupported: [],
};

const DIALECT_LANGUAGE: Record<string, DialectLanguageConfig> = {
  sqlite: {
    functions: {
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      OCTET_LENGTH: "LENGTH",
      CEIL: "CEILING",
    },
    fallbacks: {
      BIT_LENGTH: "bit_length_via_length_x8",
      DATE_FORMAT: "date_format_via_strftime",
      DATE_PARSE: "date_parse_via_datetime",
      DATE_TRUNC: "date_trunc_via_strftime",
      DATE_ADD: "date_add_via_datetime",
      DATE_DIFF: "date_diff_via_julianday",
      TO_UNIXTIME: "to_unixtime_via_strftime_s",
      FROM_UNIXTIME: "from_unixtime_via_datetime",
      ARRAY_LENGTH: "array_length_via_json_array_length",
      ARRAY_CONTAINS: "array_contains_via_json_instr",
      ARRAY_POSITION: "array_position_via_json_instr",
      ARRAY_JOIN: "array_join_via_json_string",
      ARRAY_APPEND: "array_append_via_json_insert_end",
      REGEXP_LIKE: "regex_like_via_regexp_function",
    },
  },
  postgresql: {
    functions: {
      CHARACTER_LENGTH: "CHAR_LENGTH",
      DATE_FORMAT: "TO_CHAR",
      DATE_PARSE: "TO_TIMESTAMP",
      FROM_UNIXTIME: "TO_TIMESTAMP",
      ARRAY_JOIN: "ARRAY_TO_STRING",
      REGEXP_EXTRACT: "REGEXP_SUBSTR",
    },
    fallbacks: {
      DATE_ADD: "date_add_via_epoch_timestamp",
      DATE_DIFF: "date_diff_via_extract_epoch",
      TO_UNIXTIME: "to_unixtime_via_extract_epoch",
      ARRAY_LENGTH: "array_length_dim1",
      ARRAY_CONTAINS: "array_contains_via_array_position",
      REGEXP_LIKE: "regex_like_via_regexp_match",
    },
  },
  duckdb: {},
  hetu: {
    functions: {
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      ARRAY_LENGTH: "CARDINALITY",
      ARRAY_SLICE: "SLICE",
      ARRAY_CONCAT: "CONCAT",
      REGEXP_EXTRACT: "REGEXP_EXTRACT",
    },
  },
};

export function resolveDialectLanguage(
  dialectName: string,
  override?: DialectLanguageConfig
): Required<DialectLanguageConfig> {
  const normalizedName = dialectName.toLowerCase();
  const base = DIALECT_LANGUAGE[normalizedName] ?? IDENTITY_LANGUAGE;
  const merged: Required<DialectLanguageConfig> = {
    functions: { ...base.functions, ...(override?.functions ?? {}) },
    fallbacks: { ...base.fallbacks, ...(override?.fallbacks ?? {}) },
    unsupported: [...(base.unsupported ?? []), ...(override?.unsupported ?? [])],
  };
  return merged;
}
