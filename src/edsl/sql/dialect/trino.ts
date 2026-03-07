import type { BuiltinDialectDefinition } from "./types";

export const TRINO_DIALECT: BuiltinDialectDefinition = {
  name: "trino",
  parserDialect: "Trino",
};
