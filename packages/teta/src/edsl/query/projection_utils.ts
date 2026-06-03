import type { Column, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;

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
