import type { BuiltinDialect, DialectFeatures, DialectLanguageConfig, DialectSupportTier } from "../types.ts";

/** Internal definition for one built-in dialect preset. */
export type BuiltinDialectDefinition = {
  name: BuiltinDialect;
  parserDialect: string;
  supportTier?: DialectSupportTier;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};
