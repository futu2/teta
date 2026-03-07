import type { BuiltinDialectDefinition } from "./types";

export const DUCKDB_DIALECT: BuiltinDialectDefinition = {
  name: "duckdb",
  parserDialect: "Postgresql",
};
