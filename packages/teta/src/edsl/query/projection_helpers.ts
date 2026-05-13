import { userError } from "../errors.ts";
import { map, Query } from "./builder.ts";
import type { ColumnRef, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type PickColsProjection<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: ColumnRef<TColumns[K], K>;
};

type PickColsResult<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: TColumns[K];
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

type RenameProjection<TColumns extends QueryColumns, TPattern extends string> = {
  [K in StringKeyOf<TColumns> as RenamePattern<TPattern, K>]: ColumnRef<TColumns[K], K>;
};

type PickColsHelper<TNames extends readonly [string, ...string[]]> = {
  <TInput extends ColumnRefs<Record<TNames[number], any>> | Query<Record<TNames[number], any>>>(
    input: TInput
  ): TInput extends Query<infer TColumns extends Record<TNames[number], any>>
    ? Query<PickColsResult<TColumns, TNames>>
    : TInput extends ColumnRefs<infer TColumns extends Record<TNames[number], any>>
      ? PickColsProjection<TColumns, TNames>
      : never;
};

type MapColsHelper<TPattern extends string> = {
  <TInput extends ColumnRefs<QueryColumns> | Query<QueryColumns>>(
    input: TInput
  ): TInput extends Query<infer TColumns extends QueryColumns>
    ? Query<RenameResult<TColumns, TPattern>>
    : TInput extends ColumnRefs<infer TColumns extends QueryColumns>
      ? RenameProjection<TColumns, TPattern>
      : never;
};

export function pickCols<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): PickColsHelper<TNames> {
  function pickSelectedColumns(input: ColumnRefs<QueryColumns> | Query<QueryColumns>): unknown {
    if (input instanceof Query) {
      return map(
        pickSelectedColumns as (cols: ColumnRefs<QueryColumns>) => Record<string, ColumnRef<any, string>>
      )(input);
    }

    const result: Record<string, ColumnRef<any, string>> = {};
    for (const name of names) {
      if (!(name in input)) {
        userError(
          "DEFERRED_COLUMN_UNKNOWN",
          `Unknown current row column '${name}'. Available columns: ${Object.keys(input).join(", ")}`
        );
      }
      result[name] = Reflect.get(input, name) as ColumnRef<any, string>;
    }
    return result;
  }

  return pickSelectedColumns as PickColsHelper<TNames>;
}

export function mapCols<const TPattern extends string>(
  rename: (key: string) => TPattern
): MapColsHelper<TPattern> {
  function mapSelectedColumns(input: ColumnRefs<QueryColumns> | Query<QueryColumns>): unknown {
    if (input instanceof Query) {
      return map(
        mapSelectedColumns as (cols: ColumnRefs<QueryColumns>) => Record<string, ColumnRef<any, string>>
      )(input);
    }

    const result: Record<string, ColumnRef<any, string>> = {};
    for (const key of Object.keys(input)) {
      result[rename(key)] = Reflect.get(input, key) as ColumnRef<any, string>;
    }
    return result;
  }

  return mapSelectedColumns as MapColsHelper<TPattern>;
}
