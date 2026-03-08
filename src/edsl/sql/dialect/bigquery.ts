import type { BuiltinDialectDefinition } from "./types";

export const BIGQUERY_DIALECT: BuiltinDialectDefinition = {
  name: "bigquery",
  parserDialect: "BigQuery",
  features: {
    qualifyClause: true,
  },
};
