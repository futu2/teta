import type { QueryDialect } from "../types.ts";

/** Default dialect used when no explicit dialect is provided. */
export const DEFAULT_DIALECT: QueryDialect = {
  name: "default",
  parserDialect: null,
  supportTier: "configured",
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
