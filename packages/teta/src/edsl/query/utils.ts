import { OUTER_TABLE_ALIAS } from "../core/types.ts";
import { columnOf, type Column, type ColumnRefs } from "../core/expr.ts";
import { createStringRecord, setStringRecordValue } from "../record.ts";
import { internalError } from "../errors.ts";
import { identifierName, type SqlIdentifier } from "../core/types.ts";
import type { LogicalCteSpec, LogicalStage } from "./logical.ts";

export {
  assertLoopColumns,
  assertUnionCompatible,
  columnNamesToIdentifierMap,
  identifierName,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  projectionItemOutputIdentifier,
  projectionItemOutputName,
  projectionItemsToIdentifierMap,
  shouldQuoteIdentifierName,
  sourceAliasBase,
} from "@teta/sql";

export function autoAlias(table: string | SqlIdentifier, stages: readonly LogicalStage[]): string {
  const tableName = typeof table === "string" ? table : identifierName(table);
  const joinCount = stages.reduce(
    (count, stage) => stage.kind === "join" || stage.kind === "unnest" ? count + 1 : count,
    0
  );
  const base = tableName.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base.length ? base : "t"}_${joinCount + 1}`;
}

export function mergeWiths(
  left: readonly LogicalCteSpec[],
  right: readonly LogicalCteSpec[]
): LogicalCteSpec[] {
  const seen = new Set<string>();
  const merged: LogicalCteSpec[] = [];
  for (const item of [...left, ...right]) {
    if (seen.has(item.name)) {
      internalError("INTERNAL_CTE_NAME_CONFLICT", `CTE name conflict: ${item.name}`);
    }
    seen.add(item.name);
    merged.push(item);
  }
  return merged;
}

export function qualifyOuterColumns<TColumns extends Record<string, unknown>>(
  columns: ColumnRefs<TColumns>
): ColumnRefs<TColumns> {
  const result = createStringRecord<Column<any, string>>();
  for (const key of Object.keys(columns)) {
    setStringRecordValue(result, key, columnOf<any, string>(OUTER_TABLE_ALIAS, key));
  }
  return result as ColumnRefs<TColumns>;
}
