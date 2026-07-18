import { BUILTIN_DIALECTS } from "../dialect/builtin.ts";
import { resolveDialect } from "../dialect/resolve.ts";
import type { BuiltinDialect, Dialect, DialectSupportTier, QueryDialect } from "../types.ts";
import { LANGUAGE_SPEC, type LanguageCategory } from "./spec.ts";

/** How a dialect implements one operation in the Teta language catalog. */
export type DialectCapability = "native" | "rewritten" | "emulated" | "unsupported";

/** One canonical operation from `LANGUAGE_SPEC`. */
export type LanguageOperation = (typeof LANGUAGE_SPEC)[LanguageCategory][number];

/** Capability map for every operation in the public language catalog. */
export type DialectCapabilityMap = Readonly<Record<LanguageOperation, DialectCapability>>;

/** Capability matrix for every registered built-in dialect. */
export type DialectCapabilityMatrix = Readonly<Record<BuiltinDialect, DialectCapabilityMap>>;

/** Return the repository's verification tier for a dialect configuration. */
export function getDialectSupportTier(
  dialectInput: Dialect | QueryDialect | undefined
): DialectSupportTier {
  return resolveCapabilityDialect(dialectInput).supportTier ?? "configured";
}

const LANGUAGE_OPERATIONS = Object.freeze(
  Object.values(LANGUAGE_SPEC).flatMap((operations) => operations)
) as readonly LanguageOperation[];

/** Return the canonical operations represented by the dialect capability matrix. */
export function getLanguageOperations(): readonly LanguageOperation[] {
  return LANGUAGE_OPERATIONS;
}

/** Resolve how one dialect implements a canonical language operation. */
export function getDialectCapability(
  dialectInput: Dialect | QueryDialect | undefined,
  operation: LanguageOperation
): DialectCapability {
  return getResolvedDialectCapability(resolveCapabilityDialect(dialectInput), operation);
}

/** Return the complete capability map for one resolved or configured dialect. */
export function getDialectCapabilities(
  dialectInput: Dialect | QueryDialect | undefined
): DialectCapabilityMap {
  const dialect = resolveCapabilityDialect(dialectInput);
  const result = {} as Record<LanguageOperation, DialectCapability>;
  for (const operation of LANGUAGE_OPERATIONS) {
    result[operation] = getResolvedDialectCapability(dialect, operation);
  }
  return Object.freeze(result);
}

function getResolvedDialectCapability(
  dialect: QueryDialect,
  operation: LanguageOperation
): DialectCapability {
  const normalized = operation.toUpperCase();

  if (normalized === "LATERAL_JOIN") {
    return dialect.features.lateralJoinKeyword ? "native" : "rewritten";
  }
  if (normalized === "RECURSIVE_CTE") {
    return dialect.features.recursiveCte ? "native" : "unsupported";
  }
  if (dialect.language.unsupported.includes(normalized)) return "unsupported";
  if (dialect.language.fallbacks[normalized]) return "emulated";

  const mapped = dialect.language.functions[normalized];
  return mapped && mapped.toUpperCase() !== normalized ? "rewritten" : "native";
}

function resolveCapabilityDialect(
  dialectInput: Dialect | QueryDialect | undefined
): QueryDialect {
  return isResolvedDialect(dialectInput)
    ? dialectInput
    : resolveDialect(dialectInput as Dialect | undefined);
}

/** Return the complete built-in capability matrix used for documentation and tests. */
export function getDialectCapabilityMatrix(): DialectCapabilityMatrix {
  const matrix = {} as Record<BuiltinDialect, DialectCapabilityMap>;
  for (const dialect of Object.keys(BUILTIN_DIALECTS) as BuiltinDialect[]) {
    matrix[dialect] = getDialectCapabilities(dialect);
  }
  return Object.freeze(matrix);
}

/** Render the capability matrix as Markdown for generated documentation. */
export function formatDialectCapabilityMatrixMarkdown(): string {
  const dialects = Object.keys(BUILTIN_DIALECTS) as BuiltinDialect[];
  const matrix = getDialectCapabilityMatrix();
  const header = `| Operation | ${dialects.join(" | ")} |`;
  const separator = `|---|${dialects.map(() => "---").join("|")}|`;
  const rows = LANGUAGE_OPERATIONS.map((operation) =>
    `| ${operation} | ${dialects.map((dialect) => matrix[dialect][operation]).join(" | ")} |`
  );
  return [header, separator, ...rows].join("\n");
}

function isResolvedDialect(value: unknown): value is QueryDialect {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QueryDialect>;
  return typeof candidate.name === "string"
    && (candidate.parserDialect === null || typeof candidate.parserDialect === "string")
    && (candidate.supportTier === undefined || isSupportTier(candidate.supportTier))
    && isResolvedFeatures(candidate.features)
    && isResolvedLanguage(candidate.language);
}

function isSupportTier(value: unknown): value is DialectSupportTier {
  return value === "configured" || value === "parser-checked" || value === "live-verified";
}

function isResolvedFeatures(value: unknown): value is QueryDialect["features"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<QueryDialect["features"]>;
  return typeof candidate.lateralJoinKeyword === "boolean"
    && typeof candidate.recursiveCte === "boolean"
    && typeof candidate.qualifyClause === "boolean";
}

function isResolvedLanguage(value: unknown): value is QueryDialect["language"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<QueryDialect["language"]>;
  return isStringRecord(candidate.functions)
    && isStringRecord(candidate.fallbacks)
    && isStringArray(candidate.unsupported);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return !!value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.values(value).every((item) => typeof item === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
