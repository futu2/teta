import type { Column, ColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import type { QueryColumns } from "./types.ts";
import {
  createStringRecord,
  hasOwnStringKey,
  setStringRecordValue,
} from "../record.ts";

export function assertKnownColumns(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[]
): void {
  for (const name of names) {
    if (!hasOwnStringKey(cols, name)) {
      userError(
        "DEFERRED_COLUMN_UNKNOWN",
        `Unknown current row column '${name}'. Available columns: ${Object.keys(cols).join(", ")}`
      );
    }
  }
}

export function selectColumnsByName(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[]
): Record<string, Column<any, string>> {
  const result = createStringRecord<Column<any, string>>();
  for (const name of names) {
    setStringRecordValue(result, name, Reflect.get(cols, name) as Column<any, string>);
  }
  return result;
}
