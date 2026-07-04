import { userError } from "../errors.ts";
import type { Query } from "../query/builder.ts";
import { map } from "../query/projection_builder.ts";
import { assertProjectionShape } from "../query/projection_validation.ts";
import type {
  ColumnRefs,
  ProjectionShape,
  ProjectionValue,
  ProjectionValueResult,
} from "../expr.ts";
import { mapColumnNames, selectColumnsByName } from "../query/projection_utils.ts";

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

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

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
    return selectColumnsByName(input, names);
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
      return selectColumnsByName(input, kept);
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
    return mapColumnNames(input, query.columnNames, renameKey);
  })(query)) as unknown as <TColumns extends QueryColumns>(
    query: Query<TColumns>
  ) => Query<RenameResult<TColumns, TPattern>>;
}

export function extend<
  TColumns extends QueryColumns,
  const TName extends string,
  TValue extends ProjectionValue,
>(
  name: TName,
  selector: (cols: ColumnRefs<TColumns>) => TValue
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, { [K in TName]: ProjectionValueResult<TValue> }>>;

export function extend(...args: unknown[]): unknown {
  if (args.length !== 2) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "extend() expects extend(name, selector)");
  }
  if (typeof args[0] !== "string") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "extend() expects extend(name, selector)");
  }
  if (typeof args[1] !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "extend() expects a row callback");
  }

  const selector = resolveExtendSelector(
    args[0],
    args[1] as (cols: ColumnRefs<QueryColumns>) => ProjectionValue
  );
  return (query: Query<QueryColumns>) => {
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...selectColumnsByName(cols, query.columnNames),
      ...resolveExtensionShape(selector(cols)),
    }))(query);
  };
}

function resolveExtendSelector(
  name: string,
  selector: (cols: ColumnRefs<QueryColumns>) => ProjectionValue
): (cols: ColumnRefs<QueryColumns>) => ProjectionShape {
  return (cols) => ({ [name]: selector(cols) });
}

function resolveExtensionShape(value: unknown): ProjectionShape {
  assertProjectionShape(value);
  return value;
}
