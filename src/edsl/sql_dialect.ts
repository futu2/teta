import type { Option } from "node-sql-parser";
import type {
  BuiltinDialect,
  Dialect,
  DialectFeatures,
  DialectSpec,
  QueryDialect,
  SqlFormat,
  SqlOptions,
} from "./types";
import { resolveDialectLanguage } from "./language";

const DEFAULT_DIALECT: QueryDialect = {
  name: "default",
  parserDialect: null,
  features: {
    lateralJoinKeyword: true,
    recursiveCte: true,
  },
  language: {
    functions: {},
    fallbacks: {},
    unsupported: [],
  },
};

const BUILTIN_DIALECTS: Record<
  BuiltinDialect,
  {
    name: BuiltinDialect;
    parserDialect: string;
    features?: DialectFeatures;
  }
> = {
  mysql: { name: "mysql", parserDialect: "MySQL" },
  mariadb: { name: "mariadb", parserDialect: "MariaDB" },
  postgresql: { name: "postgresql", parserDialect: "Postgresql" },
  sqlite: {
    name: "sqlite",
    parserDialect: "SQLite",
    features: { lateralJoinKeyword: false, recursiveCte: true },
  },
  trino: { name: "trino", parserDialect: "Trino" },
  transactsql: { name: "transactsql", parserDialect: "TransactSQL" },
  redshift: { name: "redshift", parserDialect: "Redshift" },
  snowflake: { name: "snowflake", parserDialect: "Snowflake" },
  bigquery: { name: "bigquery", parserDialect: "BigQuery" },
  athena: { name: "athena", parserDialect: "Athena" },
  db2: { name: "db2", parserDialect: "DB2" },
  hive: { name: "hive", parserDialect: "Hive" },
  flinksql: { name: "flinksql", parserDialect: "FlinkSQL" },
  noql: { name: "noql", parserDialect: "NoQL" },
  duckdb: { name: "duckdb", parserDialect: "Postgresql" },
  hetu: { name: "hetu", parserDialect: "Trino" },
};

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
    },
    language: resolveDialectLanguage(builtin.name),
  };
}

export function sameDialect(left: QueryDialect, right: QueryDialect): boolean {
  return (
    left.parserDialect === right.parserDialect &&
    left.features.lateralJoinKeyword === right.features.lateralJoinKeyword &&
    left.features.recursiveCte === right.features.recursiveCte
  );
}

export function cloneDialect(dialect: QueryDialect): QueryDialect {
  return {
    name: dialect.name,
    parserDialect: dialect.parserDialect,
    features: {
      lateralJoinKeyword: dialect.features.lateralJoinKeyword,
      recursiveCte: dialect.features.recursiveCte,
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
): { dialect: QueryDialect; options?: Option; sqlFormat: SqlFormat } {
  let dialect = getDefaultDialect();
  let options: Option = {};
  let sqlFormat: SqlFormat = "compact";

  if (typeof dialectOrOpt === "string") {
    dialect = resolveDialect(dialectOrOpt);
    if (typeof optOrFormat === "object" && optOrFormat) {
      const {
        format: fmt,
        dialect: inlineDialect,
        database: explicitDatabase,
        ...rest
      } = optOrFormat as SqlOptions;
      options = { ...rest };
      if (fmt) sqlFormat = fmt;
      if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
      if (explicitDatabase !== undefined) {
        options.database = explicitDatabase;
      }
    }
  } else if (dialectOrOpt && typeof dialectOrOpt === "object") {
    if (isDialectSpec(dialectOrOpt)) {
      dialect = resolveDialect(dialectOrOpt);
    } else {
      const {
        format: fmt,
        dialect: inlineDialect,
        database: explicitDatabase,
        ...rest
      } = dialectOrOpt as SqlOptions;
      options = { ...rest };
      if (fmt) sqlFormat = fmt;
      if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
      if (explicitDatabase !== undefined) {
        options.database = explicitDatabase;
      }
    }
  }

  if (typeof optOrFormat === "object" && optOrFormat && typeof dialectOrOpt !== "string") {
    const {
      format: fmt,
      dialect: inlineDialect,
      database: explicitDatabase,
      ...rest
    } = optOrFormat as SqlOptions;
    options = { ...options, ...rest };
    if (fmt) sqlFormat = fmt;
    if (inlineDialect !== undefined) dialect = resolveDialect(inlineDialect);
    if (explicitDatabase !== undefined) {
      options.database = explicitDatabase;
    }
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
  const builtinByParser = parserRaw ? lookupBuiltinDialect(parserRaw) : null;

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

  const resolvedName = rawName || builtinByName?.name || "custom";

  return {
    name: resolvedName,
    parserDialect,
    features: {
      lateralJoinKeyword,
      recursiveCte,
    },
    language: resolveDialectLanguage(resolvedName, spec.language),
  };
}

function lookupBuiltinDialect(
  input: string
):
  | {
      name: BuiltinDialect;
      parserDialect: string;
      features?: DialectFeatures;
    }
  | undefined {
  const key = input.toString().trim() as BuiltinDialect;
  const direct = BUILTIN_DIALECTS[key];
  return direct;
}

function suggestCanonicalBuiltin(input: string): BuiltinDialect | null {
  const raw = input.toString().trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower in BUILTIN_DIALECTS) {
    return lower as BuiltinDialect;
  }
  const compact = lower.replace(/[^a-z0-9]+/g, "");
  if (!compact) return null;
  if (
    compact === "hetu" ||
    compact === "hetudql" ||
    compact === "hetuengine" ||
    compact === "hetuenginedql"
  ) {
    return "hetu";
  }
  if (compact in BUILTIN_DIALECTS) {
    return compact as BuiltinDialect;
  }
  return null;
}
