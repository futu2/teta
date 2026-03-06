import type { BuiltinDialect, DialectLanguageConfig } from "../types";
import { BUILTIN_DIALECTS } from "./builtin";

export const IDENTITY_LANGUAGE: Required<DialectLanguageConfig> = {
  functions: {},
  fallbacks: {},
  unsupported: [],
};

export function resolveDialectLanguage(
  dialectName: string,
  override?: DialectLanguageConfig
): Required<DialectLanguageConfig> {
  const normalizedName = dialectName.toLowerCase() as BuiltinDialect;
  const builtin = BUILTIN_DIALECTS[normalizedName];
  const base = builtin?.language ?? IDENTITY_LANGUAGE;

  return {
    functions: { ...base.functions, ...(override?.functions ?? {}) },
    fallbacks: { ...base.fallbacks, ...(override?.fallbacks ?? {}) },
    unsupported: [...(base.unsupported ?? []), ...(override?.unsupported ?? [])],
  };
}
