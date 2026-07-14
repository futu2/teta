import type { BuiltinDialectDefinition } from "./types.ts";

export const TRINO_DIALECT: BuiltinDialectDefinition = {
  name: "trino",
  parserDialect: "Trino",
  language: {
    functions: {
      ARRAY_AGG: "ARRAY_AGG",
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      ARRAY_LENGTH: "CARDINALITY",
      ARRAY_SLICE: "SLICE",
      ARRAY_CONCAT: "CONCAT",
      REGEXP_EXTRACT: "REGEXP_EXTRACT",
    },
    fallbacks: {
      ARRAY_APPEND: "array_append_via_concat_operator",
      ARRAY_PREPEND: "array_prepend_via_concat_operator",
    },
  },
};
