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
} from "../core/types.ts";
import { OUTER_TABLE_ALIAS, internalCteLabel, isInternalCteName } from "../core/types.ts";
import { ColumnRef, type ColumnRefs } from "../core/expr.ts";
import { internalError, userError } from "../errors.ts";

const BARE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function shouldQuoteIdentifierName(name: string): boolean {
  return !BARE_IDENTIFIER_PATTERN.test(name);
}

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

export function identifierName<const Name extends string>(value: SqlIdentifier<Name>): Name {
  return value.name;
}

export function projectionItemOutputIdentifier(item: ProjectionItem): SqlIdentifier | null {
  if (item.as) return item.as;
  if (item.expr.kind === "column") return normalizeIdentifier(item.expr.name, "projection column");
  return null;
}

export function projectionItemOutputName(item: ProjectionItem): string | null {
  const identifier = projectionItemOutputIdentifier(item);
  return identifier ? identifierName(identifier) : null;
}

export function projectionItemsToIdentifierMap(
  items: ProjectionItem[]
): Readonly<Record<string, SqlIdentifier>> {
  const mapping: Record<string, SqlIdentifier> = {};
  for (const item of items) {
    const identifier = projectionItemOutputIdentifier(item);
    if (!identifier) {
      internalError("INTERNAL_PROJECTION_ITEM_OUTPUT_IDENTIFIER_MISSING", "Internal error: projection item is missing an output identifier");
    }
    mapping[identifierName(identifier)] = identifier;
  }
  return mapping;
}

export function columnNamesToIdentifierMap(
  columnNames: readonly string[]
): Readonly<Record<string, SqlIdentifier>> {
  const mapping: Record<string, SqlIdentifier> = {};
  for (const name of columnNames) {
    mapping[name] = normalizeIdentifier(name, "column");
  }
  return mapping;
}

export function normalizeTableSource(input: TableSourceInput): Source {
  if (typeof input === "string") {
    return {
      db: null,
      schema: null,
      table: normalizeIdentifier(input, "table"),
      as: null,
    };
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

export function autoAlias(table: string | SqlIdentifier, stages: Stage[]): string {
  const tableName = typeof table === "string" ? table : identifierName(table);
  const aliasBase = isInternalCteName(tableName)
    ? (internalCteLabel(tableName) ?? "cte")
    : tableName;
  const joinCount = stages.reduce((count, stage) => {
    if (stage.kind === "join") return count + 1;
    return count;
  }, 0);
  const base = aliasBase.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const name = base.length ? base : "t";
  return `${name}_${joinCount + 1}`;
}

export function normalizeJoinType(type: JoinTypeInput): JoinType {
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

export function assertLoopColumns(
  base: readonly string[],
  step: readonly string[]
): void {
  assertUnionCompatible(base, step);
}

export function qualifyOuterColumns<TColumns extends Record<string, any>>(
  columns: ColumnRefs<TColumns>
): ColumnRefs<TColumns> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const key of Object.keys(columns)) {
    result[key] = new ColumnRef<any, string>(OUTER_TABLE_ALIAS, key);
  }
  return result as ColumnRefs<TColumns>;
}

export function mergeWiths(left: CteSpec[], right: CteSpec[]): CteSpec[] {
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
