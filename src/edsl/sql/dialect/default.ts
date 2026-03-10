import type { QueryDialect } from "../../types.ts";

export const DEFAULT_DIALECT: QueryDialect = {
  name: "default",
  parserDialect: null,
  features: {
    lateralJoinKeyword: true,
    recursiveCte: true,
    qualifyClause: false,
  },
  language: {
    functions: {},
    fallbacks: {},
    unsupported: [],
  },
};
