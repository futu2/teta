import type { BuiltinDialectDefinition } from "./types";

export const SNOWFLAKE_DIALECT: BuiltinDialectDefinition = {
  name: "snowflake",
  parserDialect: "Snowflake",
  features: {
    qualifyClause: true,
  },
};
