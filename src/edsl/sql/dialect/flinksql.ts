import type { BuiltinDialectDefinition } from "./types.ts";

export const FLINKSQL_DIALECT: BuiltinDialectDefinition = {
  name: "flinksql",
  parserDialect: "FlinkSQL",
};
