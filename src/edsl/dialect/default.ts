import type { QueryDialect } from "../types";

export const DEFAULT_DIALECT: QueryDialect = {
  name: "default",
  parserDialect: null,
  features: {
    lateralJoinKeyword: true,
    recursiveCte: true,
  },
  language: {
    functions: {},
    fallbacks: {},
    unsupported: [],
  },
};
