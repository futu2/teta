import type { BuiltinDialectDefinition } from "./types.ts";

export const BIGQUERY_DIALECT: BuiltinDialectDefinition = {
  name: "bigquery",
  parserDialect: "BigQuery",
  features: {
    qualifyClause: true,
  },
};
