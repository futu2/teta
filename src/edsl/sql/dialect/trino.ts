import type { BuiltinDialectDefinition } from "./types.ts";

export const TRINO_DIALECT: BuiltinDialectDefinition = {
  name: "trino",
  parserDialect: "Trino",
};
