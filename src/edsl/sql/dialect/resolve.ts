import type { Option } from "node-sql-parser";
import type {
  Dialect,
  DialectSpec,
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
} from "../../types";
import { DEFAULT_DIALECT } from "./default";
import { resolveDialectLanguage } from "./language";
import { lookupBuiltinDialect, lookupBuiltinDialectByParser, suggestCanonicalBuiltin } from "./lookup";

export function getDefaultDialect(): QueryDialect {
  return cloneDialect(DEFAULT_DIALECT);
}

export function resolveDialect(dialect?: Dialect): QueryDialect {
  if (!dialect) return getDefaultDialect();
  if (typeof dialect === "object") {
    if (isDialectSpec(dialect)) return resolveDialectSpec(dialect);
    return getDefaultDialect();
  }
  const raw = dialect.toString().trim();
  if (!raw) return getDefaultDialect();
  const builtin = lookupBuiltinDialect(raw);
  if (!builtin) {
    const canonicalBuiltin = suggestCanonicalBuiltin(raw);
    if (canonicalBuiltin) {
      throw new Error(
        `Invalid built-in dialect '${raw}'. Use canonical lowercase '${canonicalBuiltin}'.`
      );
    }
    return {
      name: raw,
      parserDialect: null,
      features: {
        lateralJoinKeyword: true,
        recursiveCte: true,
        qualifyClause: false,
      },
      language: resolveDialectLanguage(raw),
    };
  }
  return {
    name: builtin.name,
    parserDialect: builtin.parserDialect,
    features: {
      lateralJoinKeyword: builtin.features?.lateralJoinKeyword ?? true,
      recursiveCte: builtin.features?.recursiveCte ?? true,
      qualifyClause: builtin.features?.qualifyClause ?? false,
    },
    language: resolveDialectLanguage(builtin.name),
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

export function buildSqlOptions(
  dialectOrOpt?: Dialect | SqlOptions,
  optOrFormat?: SqlOptions | SqlFormat,
  format?: SqlFormat
): {
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
} {
  let dialect = getDefaultDialect();
  let options: Option = {};
  let sqlFormat: SqlFormat = "compact";
  let parameterMode: SqlParameterMode = "inline";
  let parameterPrefix: SqlParameterPrefix = ":";

  if (typeof dialectOrOpt === "string") {
    dialect = resolveDialect(dialectOrOpt);
    if (typeof optOrFormat === "object" && optOrFormat) {
      const {
        format: fmt,
        dialect: inlineDialect,
        database: explicitDatabase,
        parameterMode: inlineParameterMode,
        parameterPrefix: inlineParameterPrefix,
        ...rest
      } = optOrFormat as SqlOptions;
      options = { ...rest };
      if (fmt) sqlFormat = fmt;
      if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
      if (explicitDatabase !== undefined) {
        options.database = explicitDatabase;
      }
      if (inlineParameterMode) parameterMode = inlineParameterMode;
      if (inlineParameterPrefix) parameterPrefix = inlineParameterPrefix;
    }
  } else if (dialectOrOpt && typeof dialectOrOpt === "object") {
    if (isDialectSpec(dialectOrOpt)) {
      dialect = resolveDialect(dialectOrOpt);
    } else {
      const {
        format: fmt,
        dialect: inlineDialect,
        database: explicitDatabase,
        parameterMode: inlineParameterMode,
        parameterPrefix: inlineParameterPrefix,
        ...rest
      } = dialectOrOpt as SqlOptions;
      options = { ...rest };
      if (fmt) sqlFormat = fmt;
      if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
      if (explicitDatabase !== undefined) {
        options.database = explicitDatabase;
      }
      if (inlineParameterMode) parameterMode = inlineParameterMode;
      if (inlineParameterPrefix) parameterPrefix = inlineParameterPrefix;
    }
  }

  if (typeof optOrFormat === "object" && optOrFormat && typeof dialectOrOpt !== "string") {
    const {
      format: fmt,
      dialect: inlineDialect,
      database: explicitDatabase,
      parameterMode: inlineParameterMode,
      parameterPrefix: inlineParameterPrefix,
      ...rest
    } = optOrFormat as SqlOptions;
    options = { ...options, ...rest };
    if (fmt) sqlFormat = fmt;
    if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
    if (explicitDatabase !== undefined) {
      options.database = explicitDatabase;
    }
    if (inlineParameterMode) parameterMode = inlineParameterMode;
    if (inlineParameterPrefix) parameterPrefix = inlineParameterPrefix;
  }

  if (typeof optOrFormat === "string") sqlFormat = optOrFormat;
  if (format) sqlFormat = format;

  if (options.database === undefined && dialect.parserDialect) {
    options.database = dialect.parserDialect;
  }

  const hasOptions = Object.keys(options).length > 0;

  return {
    dialect,
    options: hasOptions ? options : undefined,
    sqlFormat,
    parameterMode,
    parameterPrefix,
  };
}

function isDialectSpec(value: unknown): value is DialectSpec {
  return typeof value === "object" && value !== null && "name" in value;
}

function resolveDialectSpec(spec: DialectSpec): QueryDialect {
  const rawName = spec.name.toString().trim();
  const canonicalBuiltin = suggestCanonicalBuiltin(rawName);
  if (canonicalBuiltin && rawName !== canonicalBuiltin) {
    throw new Error(
      `Invalid built-in dialect '${rawName}'. Use canonical lowercase '${canonicalBuiltin}'.`
    );
  }
  const builtinByName = lookupBuiltinDialect(rawName);
  const parserSource =
    spec.parserDialect === undefined
      ? builtinByName?.parserDialect ?? null
      : spec.parserDialect;
  const parserRaw = parserSource === null ? null : parserSource.toString().trim();
  const builtinByParser = parserRaw ? lookupBuiltinDialectByParser(parserRaw) : null;

  const parserDialect = parserRaw && builtinByParser ? builtinByParser.parserDialect : parserRaw;
  const lateralJoinKeyword =
    spec.features?.lateralJoinKeyword ??
    builtinByName?.features?.lateralJoinKeyword ??
    builtinByParser?.features?.lateralJoinKeyword ??
    true;
  const recursiveCte =
    spec.features?.recursiveCte ??
    builtinByName?.features?.recursiveCte ??
    builtinByParser?.features?.recursiveCte ??
    true;
  const qualifyClause =
    spec.features?.qualifyClause ??
    builtinByName?.features?.qualifyClause ??
    builtinByParser?.features?.qualifyClause ??
    false;

  const resolvedName = rawName || builtinByName?.name || "custom";

  return {
    name: resolvedName,
    parserDialect,
    features: {
      lateralJoinKeyword,
      recursiveCte,
      qualifyClause,
    },
    language: resolveDialectLanguage(resolvedName, spec.language),
  };
}
