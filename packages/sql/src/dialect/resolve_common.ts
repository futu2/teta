import type {
  DialectFeatures,
  QueryDialect,
} from "../types.ts";
import { DEFAULT_DIALECT } from "./default.ts";
import { resolveDialectLanguage } from "./language.ts";
import type { BuiltinDialectDefinition } from "./types.ts";
import { lookupBuiltinDialect, suggestCanonicalBuiltin } from "./lookup.ts";
import { userError } from "../errors.ts";

export function getDefaultDialect(): QueryDialect {
  return cloneDialect(DEFAULT_DIALECT);
}

export function cloneDialect(dialect: QueryDialect): QueryDialect {
  return {
    name: dialect.name,
    parserDialect: dialect.parserDialect,
    features: {
      lateralJoinKeyword: dialect.features.lateralJoinKeyword,
      recursiveCte: dialect.features.recursiveCte,
      qualifyClause: dialect.features.qualifyClause,
    },
    language: {
      functions: { ...dialect.language.functions },
      fallbacks: { ...dialect.language.fallbacks },
      unsupported: [...dialect.language.unsupported],
    },
  };
}

export function sameDialect(left: QueryDialect, right: QueryDialect): boolean {
  return (
    left.parserDialect === right.parserDialect &&
    left.features.lateralJoinKeyword === right.features.lateralJoinKeyword &&
    left.features.recursiveCte === right.features.recursiveCte &&
    left.features.qualifyClause === right.features.qualifyClause
  );
}

export function resolveNamedDialect(rawName: string): QueryDialect {
  assertCanonicalBuiltinName(rawName);
  const builtin = lookupBuiltinDialect(rawName);
  if (!builtin) {
    return {
      name: rawName,
      parserDialect: null,
      features: defaultDialectFeatures(),
      language: resolveDialectLanguage(rawName),
    };
  }
  return {
    name: builtin.name,
    parserDialect: builtin.parserDialect,
    features: resolveFeatureFlags(undefined, builtin, null),
    language: resolveDialectLanguage(builtin.name),
  };
}

export function resolveFeatureFlags(
  explicit: DialectFeatures | undefined,
  builtinByName: BuiltinDialectDefinition | undefined,
  builtinByParser: BuiltinDialectDefinition | null
): QueryDialect["features"] {
  return {
    lateralJoinKeyword:
      explicit?.lateralJoinKeyword ??
      builtinByName?.features?.lateralJoinKeyword ??
      builtinByParser?.features?.lateralJoinKeyword ??
      true,
    recursiveCte:
      explicit?.recursiveCte ??
      builtinByName?.features?.recursiveCte ??
      builtinByParser?.features?.recursiveCte ??
      true,
    qualifyClause:
      explicit?.qualifyClause ??
      builtinByName?.features?.qualifyClause ??
      builtinByParser?.features?.qualifyClause ??
      false,
  };
}

export function assertCanonicalBuiltinName(rawName: string): void {
  const canonicalBuiltin = suggestCanonicalBuiltin(rawName);
  if (canonicalBuiltin && rawName !== canonicalBuiltin) {
    userError(
      "INVALID_BUILTIN_DIALECT_NAME",
      `Invalid built-in dialect '${rawName}'. Use canonical lowercase '${canonicalBuiltin}'.`
    );
  }
}

function defaultDialectFeatures(): QueryDialect["features"] {
  return {
    lateralJoinKeyword: true,
    recursiveCte: true,
    qualifyClause: false,
  };
}
