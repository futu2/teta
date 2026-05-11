import type { BuiltinDialect } from "../types.ts";
import { BUILTIN_DIALECTS } from "./builtin.ts";
import type { BuiltinDialectDefinition } from "./types.ts";

const COMPACT_ALIASES: Record<string, BuiltinDialect> = {
  hetu: "hetu",
  hetudql: "hetu",
  hetuengine: "hetu",
  hetuenginedql: "hetu",
};

export function lookupBuiltinDialect(input: string): BuiltinDialectDefinition | undefined {
  const key = input.toString().trim() as BuiltinDialect;
  return BUILTIN_DIALECTS[key];
}

export function lookupBuiltinDialectByParser(
  input: string
): BuiltinDialectDefinition | undefined {
  const raw = input.toString().trim();
  if (!raw) return undefined;

  return Object.values(BUILTIN_DIALECTS).find(
    (dialect) => dialect.parserDialect === raw
  );
}

export function suggestCanonicalBuiltin(input: string): BuiltinDialect | null {
  const raw = input.toString().trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower in BUILTIN_DIALECTS) {
    return lower as BuiltinDialect;
  }

  const compact = lower.replace(/[^a-z0-9]+/g, "");
  if (!compact) return null;

  const aliased = COMPACT_ALIASES[compact];
  if (aliased) return aliased;
  if (compact in BUILTIN_DIALECTS) {
    return compact as BuiltinDialect;
  }

  return null;
}
