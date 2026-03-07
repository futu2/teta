import type { CteSpec, JoinType, JoinTypeInput, Stage } from "../core/types";
import { OUTER_TABLE_ALIAS } from "../core/types";
import { ColumnRef, type ColumnRefs } from "../core/expr";

export function parseTableName(name: string): { table: string; schema: string | null } {
  const parts = name.split(".");
  if (parts.length === 2) {
    const schema = parts[0];
    const table = parts[1];
    if (schema !== undefined && table !== undefined) {
      return { schema, table };
    }
  }
  return { schema: null, table: name };
}

export function autoAlias(table: string, stages: Stage[]): string {
  const joinCount = stages.reduce((count, stage) => {
    if (stage.kind === "join") return count + 1;
    return count;
  }, 0);
  const base = table.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
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
