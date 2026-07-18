import type { BuiltinDialectDefinition } from "./types.ts";

export const DUCKDB_DIALECT: BuiltinDialectDefinition = {
  name: "duckdb",
  parserDialect: "Postgresql",
  supportTier: "live-verified",
  language: {
    functions: {
      DATE_FORMAT: "STRFTIME",
      OCTET_LENGTH: "LENGTH",
      DATE_PARSE: "STRPTIME",
      FROM_UNIXTIME: "TO_TIMESTAMP",
      REGEXP_LIKE: "REGEXP_MATCHES",
      ARRAY_JOIN: "ARRAY_TO_STRING",
      ARRAY_POSITION: "LIST_POSITION",
    },
    fallbacks: {
      OVERLAY: "overlay_via_concat_substring",
      ARRAY_SLICE: "array_slice_via_start_length",
      ARRAY_PREPEND: "array_prepend_via_list_concat",
      DATE_ADD: "date_add_via_epoch_timestamp",
      DATE_DIFF: "date_diff_via_extract_epoch",
      TO_UNIXTIME: "to_unixtime_via_extract_epoch",
    },
  },
};
