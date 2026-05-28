import type { BuiltinDialectDefinition } from "./types.ts";

export const POSTGRESQL_DIALECT: BuiltinDialectDefinition = {
  name: "postgresql",
  parserDialect: "Postgresql",
  language: {
    functions: {
      ARRAY_AGG: "ARRAY_AGG",
      CHARACTER_LENGTH: "CHAR_LENGTH",
      FROM_UNIXTIME: "TO_TIMESTAMP",
      ARRAY_JOIN: "ARRAY_TO_STRING",
    },
    fallbacks: {
      EXTRACT: "extract_via_integer_cast",
      DATE_FORMAT: "date_format_via_to_char",
      DATE_PARSE: "date_parse_via_to_timestamp",
      DATE_ADD: "date_add_via_epoch_timestamp",
      DATE_DIFF: "date_diff_via_extract_epoch",
      TO_UNIXTIME: "to_unixtime_via_extract_epoch",
      ARRAY_LENGTH: "array_length_dim1",
      ARRAY_CONTAINS: "array_contains_via_array_position",
      ARRAY_PREPEND: "array_prepend_via_function",
      ARRAY_CONCAT: "array_concat_via_concat_operator",
      REGEXP_LIKE: "regex_like_via_regexp_match",
      REGEXP_EXTRACT: "regex_extract_via_substring",
    },
  },
};
