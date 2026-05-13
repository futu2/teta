import { userError } from "../errors.ts";
import { map, Query } from "./builder.ts";
import type { ColumnRef, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type PickResult<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: TColumns[K];
};

type DropResult<
  TColumns extends QueryColumns,
  TNames extends readonly string[],
> = {
  [K in Exclude<StringKeyOf<TColumns>, TNames[number]>]: TColumns[K];
};

type RenamePattern<TPattern extends string, TKey extends string> =
  TPattern extends `${infer TPrefix}_${string}`
    ? string extends TPrefix
      ? TPattern extends `${string}_${infer TSuffix}`
        ? `${TKey}_${TSuffix}`
        : string
      : `${TPrefix}_${TKey}`
    : TPattern extends `${string}_${infer TSuffix}`
      ? `${TKey}_${TSuffix}`
      : string;

type RenameResult<TColumns extends QueryColumns, TPattern extends string> = {
  [K in StringKeyOf<TColumns> as RenamePattern<TPattern, K>]: TColumns[K];
};

function assertKnownColumns(
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

export function pick<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<PickResult<TColumns, TNames>> {
  return ((query: Query<QueryColumns>) => map((input: ColumnRefs<QueryColumns>) => {
    assertKnownColumns(input, names);
    const result: Record<string, ColumnRef<any, string>> = {};
    for (const name of names) {
      result[name] = Reflect.get(input, name) as ColumnRef<any, string>;
    }
    return result;
  })(query)) as unknown as <TColumns extends Record<TNames[number], any>>(
    query: Query<TColumns>
  ) => Query<PickResult<TColumns, TNames>>;
}

export function drop<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<DropResult<TColumns, TNames>> {
  return ((query: Query<QueryColumns>) => {
    assertKnownColumns(query.columns as ColumnRefs<QueryColumns>, names);
    const dropped = new Set<string>(names);
    const kept = query.columnNames.filter((name: string) => !dropped.has(name));

    return map((input: ColumnRefs<QueryColumns>) => {
      const result: Record<string, ColumnRef<any, string>> = {};
      for (const name of kept) {
        result[name] = Reflect.get(input, name) as ColumnRef<any, string>;
      }
      return result;
    })(query);
  }) as unknown as <TColumns extends Record<TNames[number], any>>(
    query: Query<TColumns>
  ) => Query<DropResult<TColumns, TNames>>;
}

export function rename<const TPattern extends string>(
  renameKey: (key: string) => TPattern
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
) => Query<RenameResult<TColumns, TPattern>> {
  return ((query: Query<QueryColumns>) => map((input: ColumnRefs<QueryColumns>) => {
    const result: Record<string, ColumnRef<any, string>> = {};
    for (const key of Object.keys(input)) {
      result[renameKey(key)] = Reflect.get(input, key) as ColumnRef<any, string>;
    }
    return result;
  })(query)) as unknown as <TColumns extends QueryColumns>(
    query: Query<TColumns>
  ) => Query<RenameResult<TColumns, TPattern>>;
}
