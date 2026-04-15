import type { BuiltinDialectDefinition } from "./types.ts";

export const HIVE_DIALECT: BuiltinDialectDefinition = {
  name: "hive",
  parserDialect: "Hive",
  language: {
    functions: {
      ARRAY_AGG: "COLLECT_LIST",
    },
  },
};
