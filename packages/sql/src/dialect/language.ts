import type { BuiltinDialect, DialectLanguageConfig } from "../types.ts";
import { assertSqlFunctionName } from "../ir/tokens.ts";
import { BUILTIN_DIALECTS } from "./builtin.ts";

/** Empty language config that leaves function names unchanged. */
export const IDENTITY_LANGUAGE: Required<DialectLanguageConfig> = {
  functions: {},
  fallbacks: {},
  unsupported: [],
};

/** Resolve dialect function names, fallback rewrites, and unsupported functions. */
export function resolveDialectLanguage(
  dialectName: string,
  override?: DialectLanguageConfig
): Required<DialectLanguageConfig> {
  const normalizedName = dialectName.toLowerCase() as BuiltinDialect;
  const builtin = BUILTIN_DIALECTS[normalizedName];
  const base = builtin?.language ?? IDENTITY_LANGUAGE;
  const functions = { ...base.functions, ...(override?.functions ?? {}) };
  validateFunctionMappings(functions);

  return {
    functions,
    fallbacks: { ...base.fallbacks, ...(override?.fallbacks ?? {}) },
    unsupported: [...(base.unsupported ?? []), ...(override?.unsupported ?? [])],
  };
}

function validateFunctionMappings(functions: Readonly<Record<string, string>>): void {
  for (const [operation, functionName] of Object.entries(functions)) {
    assertSqlFunctionName(functionName, `function mapping for ${operation}`);
  }
}
