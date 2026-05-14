import type { BuiltinDialect, DialectFeatures, DialectLanguageConfig } from "../types.ts";

/** Internal definition for one built-in dialect preset. */
export type BuiltinDialectDefinition = {
  name: BuiltinDialect;
  parserDialect: string;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};
