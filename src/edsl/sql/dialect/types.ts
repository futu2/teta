import type { BuiltinDialect, DialectFeatures, DialectLanguageConfig } from "../../types.ts";

export type BuiltinDialectDefinition = {
  name: BuiltinDialect;
  parserDialect: string;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};
