import type { BuiltinDialectDefinition } from "./types.ts";

export const TRANSACTSQL_DIALECT: BuiltinDialectDefinition = {
  name: "transactsql",
  parserDialect: "TransactSQL",
};
