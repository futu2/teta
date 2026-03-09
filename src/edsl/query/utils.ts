import type {
  CteSpec,
  IdentifierInput,
  JoinType,
  JoinTypeInput,
  SelectItem,
  Source,
  SqlIdentifier,
  Stage,
  TableSourceInput,
} from "../core/types";
import { OUTER_TABLE_ALIAS, internalCteLabel, isInternalCteName } from "../core/types";
import { ColumnRef, type ColumnRefs } from "../core/expr";

export function normalizeIdentifier<const Name extends string>(
  input: IdentifierInput<Name>,
  label = "identifier"
): SqlIdentifier<Name> {
  if (typeof input === "string") {
    return {
      name: normalizeSourcePart(input, label),
      quoted: false,
    };
  }

  return {
    name: normalizeSourcePart(input.name, label),
    quoted: input.quoted ?? true,
  };
}

export function unquotedIdentifier<const Name extends string>(name: Name): SqlIdentifier<Name> {
  return {
    name: normalizeSourcePart(name, "identifier"),
    quoted: false,
  };
}

export function identifierName<const Name extends string>(value: SqlIdentifier<Name>): Name {
  return value.name;
}

export function selectItemOutputIdentifier(item: SelectItem): SqlIdentifier | null {
  if (item.as) return item.as;
  if (item.expr.kind === "column") return unquotedIdentifier(item.expr.name);
  return null;
}

export function selectItemOutputName(item: SelectItem): string | null {
  const identifier = selectItemOutputIdentifier(item);
  return identifier ? identifierName(identifier) : null;
}

export function selectItemsToIdentifierMap(
  items: SelectItem[]
): Readonly<Record<string, SqlIdentifier>> | null {
  const mapping: Record<string, SqlIdentifier> = {};
  for (const item of items) {
    const identifier = selectItemOutputIdentifier(item);
    if (!identifier) return null;
    mapping[identifierName(identifier)] = identifier;
  }
  return mapping;
}

export function columnNamesToIdentifierMap(
  columnNames: readonly string[] | null
): Readonly<Record<string, SqlIdentifier>> | null {
  if (!columnNames) return null;
  const mapping: Record<string, SqlIdentifier> = {};
  for (const name of columnNames) {
    mapping[name] = unquotedIdentifier(name);
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
      throw new Error(`Unsupported join type: ${type}`);
  }
}

export function assertUnionCompatible(
  left: readonly string[],
  right: readonly string[]
): void {
  if (left.length !== right.length) {
    throw new Error("union requires both queries to have the same columns");
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      throw new Error("union requires both queries to have matching column names");
    }
  }
}

export function assertLoopColumns(
  base: readonly string[] | null,
  step: readonly string[] | null
): void {
  if (!base || !step) {
    throw new Error("loop requires explicit column lists for base and step");
  }
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
      throw new Error(`CTE name conflict: ${item.name}`);
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
    throw new Error(`table source ${label} must be non-empty`);
  }
  return normalized as Name;
}
