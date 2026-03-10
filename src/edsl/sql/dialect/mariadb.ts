import type { BuiltinDialectDefinition } from "./types.ts";

export const MARIADB_DIALECT: BuiltinDialectDefinition = {
  name: "mariadb",
  parserDialect: "MariaDB",
};
