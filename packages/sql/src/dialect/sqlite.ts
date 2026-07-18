import type { BuiltinDialectDefinition } from "./types.ts";

export const SQLITE_DIALECT: BuiltinDialectDefinition = {
  name: "sqlite",
  parserDialect: "SQLite",
  supportTier: "live-verified",
  features: {
    lateralJoinKeyword: false,
    recursiveCte: true,
  },
  language: {
    functions: {
      ARRAY_AGG: "JSON_GROUP_ARRAY",
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      OCTET_LENGTH: "LENGTH",
      CEIL: "CEILING",
      GREATEST: "MAX",
      LEAST: "MIN",
    },
    fallbacks: {
      BIT_LENGTH: "bit_length_via_length_x8",
      POSITION: "position_via_instr",
      CAST_DATE: "cast_date_via_date_function",
      EXTRACT: "extract_via_strftime",
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
};
