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

export function mapColumnNames(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[],
  renameKey: (key: string) => string
): Record<string, Column<any, string>> {
  const result = createStringRecord<Column<any, string>>();
  for (const name of names) {
    const renamed = renameKey(name);
    if (typeof renamed !== "string" || renamed.trim().length === 0) {
      userError("DEFERRED_INPUT_INVALID", "rename() must return a non-empty column name");
    }
    if (hasOwnStringKey(result, renamed)) {
      userError("DEFERRED_INPUT_INVALID", `rename() produced duplicate column name '${renamed}'`);
    }
    setStringRecordValue(
      result,
      renamed,
      Reflect.get(cols, name) as Column<any, string>
    );
  }
  return result;
}
