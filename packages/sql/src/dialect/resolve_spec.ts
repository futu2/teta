import type {
  DialectSpec,
  QueryDialect,
} from "../types.ts";
import { resolveDialectLanguage } from "./language.ts";
import { lookupBuiltinDialect, lookupBuiltinDialectByParser } from "./lookup.ts";
import {
  assertCanonicalBuiltinName,
  resolveFeatureFlags,
} from "./resolve_common.ts";

export function isDialectSpec(value: unknown): value is DialectSpec {
  return typeof value === "object" && value !== null && "name" in value;
}

export function resolveDialectSpec(spec: DialectSpec): QueryDialect {
  const rawName = spec.name.toString().trim();
  assertCanonicalBuiltinName(rawName);

  const builtinByName = lookupBuiltinDialect(rawName);
  const parserSource =
    spec.parserDialect === undefined
      ? builtinByName?.parserDialect ?? null
      : spec.parserDialect;
  const parserRaw = parserSource === null ? null : parserSource.toString().trim();
  const builtinByParser = parserRaw ? (lookupBuiltinDialectByParser(parserRaw) ?? null) : null;
  const parserDialect = parserRaw && builtinByParser ? builtinByParser.parserDialect : parserRaw;
  const resolvedName = rawName || builtinByName?.name || "custom";

  return {
    name: resolvedName,
    parserDialect,
    supportTier: spec.supportTier ?? builtinByName?.supportTier ?? "configured",
    features: resolveFeatureFlags(spec.features, builtinByName, builtinByParser),
    language: resolveDialectLanguage(resolvedName, spec.language),
  };
}
