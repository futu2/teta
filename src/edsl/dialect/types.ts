import type { BuiltinDialect, DialectFeatures, DialectLanguageConfig } from "../types";

export type BuiltinDialectDefinition = {
  name: BuiltinDialect;
  parserDialect: string;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};
