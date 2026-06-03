import { OUTER_TABLE_ALIAS } from "../core/types.ts";
import { columnOf, type Column, type ColumnRefs } from "../core/expr.ts";

export {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  columnNamesToIdentifierMap,
  identifierName,
  mergeWiths,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  projectionItemOutputIdentifier,
  projectionItemOutputName,
  projectionItemsToIdentifierMap,
  shouldQuoteIdentifierName,
  sourceAliasBase,
} from "@teta/sql";

export function qualifyOuterColumns<TColumns extends Record<string, any>>(
  columns: ColumnRefs<TColumns>
): ColumnRefs<TColumns> {
  const result: Record<string, Column<any, string>> = {};
  for (const key of Object.keys(columns)) {
    result[key] = columnOf<any, string>(OUTER_TABLE_ALIAS, key);
  }
  return result as ColumnRefs<TColumns>;
}
