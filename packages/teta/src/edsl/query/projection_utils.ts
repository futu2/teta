import type { Column, ColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import type { QueryColumns } from "./types.ts";

export function assertKnownColumns(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[]
): void {
  for (const name of names) {
    if (!(name in cols)) {
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
  const result: Record<string, Column<any, string>> = {};
  for (const name of names) {
    result[name] = Reflect.get(cols, name) as Column<any, string>;
  }
  return result;
}

export function mapColumnNames(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[],
  renameKey: (key: string) => string
): Record<string, Column<any, string>> {
  const result: Record<string, Column<any, string>> = {};
  for (const name of names) {
    result[renameKey(name)] = Reflect.get(cols, name) as Column<any, string>;
  }
  return result;
}
