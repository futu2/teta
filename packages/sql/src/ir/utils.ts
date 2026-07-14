import type {
  CteSpec,
  IdentifierInput,
  JoinType,
  JoinTypeInput,
  ProjectionItem,
  Source,
  SqlIdentifier,
  Stage,
  TableSourceInput,
} from "./types.ts";
import { internalCteLabel, isInternalCteName, isValuesSource } from "./types.ts";
import { internalError, userError } from "../errors.ts";
import { createDictionary } from "../dictionary.ts";
import { isSqlIdentifierSegment } from "./tokens.ts";

/** Return true when an identifier needs quoting to remain valid SQL. */
export function shouldQuoteIdentifierName(name: string): boolean {
  return !isSqlIdentifierSegment(name) || name !== name.toLowerCase();
}

/** Normalize a string or identifier object into a `SqlIdentifier`. */
export function normalizeIdentifier<const Name extends string>(
  input: IdentifierInput<Name>,
  label = "identifier"
): SqlIdentifier<Name> {
  if (typeof input === "string") {
    const name = normalizeSourcePart(input, label);
    return {
      name,
      quoted: shouldQuoteIdentifierName(name),
    };
  }

  const name = normalizeSourcePart(input.name, label);
  return {
    name,
    quoted: input.quoted ?? shouldQuoteIdentifierName(name),
  };
}

/** Extract the raw name from a normalized SQL identifier. */
export function identifierName<const Name extends string>(value: SqlIdentifier<Name>): Name {
  return value.name;
}

/** Resolve the output identifier for a projection item, if one can be inferred. */
export function projectionItemOutputIdentifier(item: ProjectionItem): SqlIdentifier | null {
  if (item.as) return item.as;
  if (item.expr.kind === "column") return normalizeIdentifier(item.expr.name, "projection column");
  return null;
}

/** Resolve the output column name for a projection item, if one can be inferred. */
export function projectionItemOutputName(item: ProjectionItem): string | null {
  const identifier = projectionItemOutputIdentifier(item);
  return identifier ? identifierName(identifier) : null;
}

/** Build a projection output-name to identifier map. */
export function projectionItemsToIdentifierMap(
  items: readonly ProjectionItem[]
): Readonly<Record<string, SqlIdentifier>> {
  const mapping = createDictionary<SqlIdentifier>();
  for (const item of items) {
    const identifier = projectionItemOutputIdentifier(item);
    if (!identifier) {
      internalError("INTERNAL_PROJECTION_ITEM_OUTPUT_IDENTIFIER_MISSING", "Internal error: projection item is missing an output identifier");
    }
    mapping[identifierName(identifier)] = identifier;
  }
  return mapping;
}

/** Build a column-name to normalized identifier map. */
export function columnNamesToIdentifierMap(
  columnNames: readonly string[]
): Readonly<Record<string, SqlIdentifier>> {
  const mapping = createDictionary<SqlIdentifier>();
  for (const name of columnNames) {
    mapping[name] = normalizeIdentifier(name, "column");
  }
  return mapping;
}

/** Normalize user-facing table-source input into IR source metadata. */
export function normalizeTableSource(input: TableSourceInput): Source {
  if (typeof input === "string") {
    return fromStringPath(input);
  }

  if ("path" in input) {
    return fromPath(input.path, input.as ?? null);
  }

  return {
    db: normalizeOptionalIdentifier(input.db, "db"),
    schema: normalizeOptionalIdentifier(input.schema, "schema"),
    table: normalizeIdentifier(input.table, "table"),
    as: normalizeOptionalIdentifier(input.as, "alias"),
  };
}

function fromStringPath(input: string): Source {
  const normalized = normalizeSourcePart(input, "table");
  const path = normalized.split(".");

  if (path.length === 1) {
    return {
      db: null,
      schema: null,
      table: normalizeIdentifier(path[0]!, "table"),
      as: null,
    };
  }

  if (path.length === 2) {
    return fromPath([path[0]!, path[1]!], null);
  }

  if (path.length === 3) {
    return fromPath([path[0]!, path[1]!, path[2]!], null);
  }

  userError(
    "INVALID_TABLE_SOURCE",
    "string table sources may contain at most db.schema.table"
  );
}

/** Generate a stable table alias for a source at the current stage depth. */
export function autoAlias(table: string | SqlIdentifier, stages: readonly Stage[]): string {
  const tableName = typeof table === "string" ? table : identifierName(table);
  const aliasBase = isInternalCteName(tableName)
    ? (internalCteLabel(tableName) ?? "cte")
    : tableName;
  const joinCount = stages.reduce((count, stage) => {
    if (stage.kind === "join" || stage.kind === "unnest") return count + 1;
    return count;
  }, 0);
  const base = aliasBase.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const name = base.length ? base : "t";
  return `${name}_${joinCount + 1}`;
}

/** Return the source name used as the base for generated aliases. */
export function sourceAliasBase(source: Source): string | SqlIdentifier {
  if (isValuesSource(source)) {
    return "values";
  }
  return source.table;
}

/** Normalize a user-facing join type into canonical IR form. */
export function normalizeJoinType(type: JoinTypeInput | (string & {})): JoinType {
  const normalized = type.toString().trim().toUpperCase();
  switch (normalized) {
    case "INNER":
    case "LEFT":
    case "RIGHT":
    case "FULL":
      return normalized;
    default:
      userError("INVALID_JOIN_TYPE", `Unsupported join type: ${type}`);
  }
}

/** Assert that two union inputs expose the same columns in the same order. */
export function assertUnionCompatible(
  left: readonly string[],
  right: readonly string[]
): void {
  if (left.length !== right.length) {
    userError("UNION_COLUMN_COUNT_MISMATCH", "union requires both queries to have the same columns");
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      userError("UNION_COLUMN_NAME_MISMATCH", "union requires both queries to have matching column names");
    }
  }
}

/** Assert that recursive loop base and step queries expose identical columns. */
export function assertLoopColumns(
  base: readonly string[],
  step: readonly string[]
): void {
  assertUnionCompatible(base, step);
}

/** Merge two CTE lists while rejecting duplicate names. */
export function mergeWiths(left: readonly CteSpec[], right: readonly CteSpec[]): CteSpec[] {
  if (left.length === 0) return right.length ? [...right] : [];
  if (right.length === 0) return [...left];
  const seen = new Set<string>();
  const merged: CteSpec[] = [];
  for (const item of left) {
    seen.add(item.name);
    merged.push(item);
  }
  for (const item of right) {
    if (seen.has(item.name)) {
      internalError("INTERNAL_CTE_NAME_CONFLICT", `CTE name conflict: ${item.name}`);
    }
    seen.add(item.name);
    merged.push(item);
  }
  return merged;
}

function fromPath(
  path:
    | readonly [IdentifierInput]
    | readonly [IdentifierInput, IdentifierInput]
    | readonly [IdentifierInput, IdentifierInput, IdentifierInput],
  as: IdentifierInput | null
): Source {
  if (path.length === 1) {
    return {
      db: null,
      schema: null,
      table: normalizeIdentifier(path[0], "table"),
      as: normalizeOptionalIdentifier(as, "alias"),
    };
  }
  if (path.length === 2) {
    return {
      db: null,
      schema: normalizeIdentifier(path[0], "schema"),
      table: normalizeIdentifier(path[1], "table"),
      as: normalizeOptionalIdentifier(as, "alias"),
    };
  }
  return {
    db: normalizeIdentifier(path[0], "db"),
    schema: normalizeIdentifier(path[1], "schema"),
    table: normalizeIdentifier(path[2], "table"),
    as: normalizeOptionalIdentifier(as, "alias"),
  };
}

function normalizeOptionalIdentifier(
  value: IdentifierInput | null | undefined,
  label: string
): SqlIdentifier | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, label);
}

function normalizeSourcePart<const Name extends string>(value: Name, label: string): Name {
  const normalized = value.toString().trim();
  if (!normalized) {
    userError("INVALID_TABLE_SOURCE", `table source ${label} must be non-empty`);
  }
  return normalized as Name;
}
