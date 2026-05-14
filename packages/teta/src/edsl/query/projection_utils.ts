import type { ColumnRef, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;

export function selectColumnsByName(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[]
): Record<string, ColumnRef<any, string>> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const name of names) {
    result[name] = Reflect.get(cols, name) as ColumnRef<any, string>;
  }
  return result;
}

export function mapColumnNames(
  cols: ColumnRefs<QueryColumns>,
  names: readonly string[],
  renameKey: (key: string) => string
): Record<string, ColumnRef<any, string>> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const name of names) {
    result[renameKey(name)] = Reflect.get(cols, name) as ColumnRef<any, string>;
  }
  return result;
}
