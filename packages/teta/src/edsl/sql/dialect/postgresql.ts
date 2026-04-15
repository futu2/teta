import type { BuiltinDialectDefinition } from "./types.ts";

export const POSTGRESQL_DIALECT: BuiltinDialectDefinition = {
  name: "postgresql",
  parserDialect: "Postgresql",
  language: {
    functions: {
      ARRAY_AGG: "ARRAY_AGG",
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
};
