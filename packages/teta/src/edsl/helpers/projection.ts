import { userError } from "../errors.ts";
import {
  createQueryStep,
  getQueryState,
  type Query,
} from "../query/core.ts";
import { deriveQuery } from "../query/derive.ts";
import { map } from "../query/projection_builder.ts";
import { assertProjectionShape } from "../query/projection_validation.ts";
import { resolveFilterQuery, resolveMapQuery } from "../query/transitions.ts";
import type {
  ColumnRefs,
  Expr,
  ProjectionShape,
  ProjectionValue,
  ProjectionValueResult,
} from "../expr.ts";
import {
  assertKnownColumns,
  mapColumnNames,
  selectColumnsByName,
} from "../query/projection_utils.ts";
import type { QueryColumns } from "../query/types.ts";
type StringKeyOf<T> = Extract<keyof T, string>;
type GenericQueryStep<TInput extends QueryColumns, TOutput extends QueryColumns> =
  (query: Query<TInput>) => Query<TOutput>;

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

type RenamePatternPart<
  TPart extends string,
  TKey extends string,
  TEmbedded extends boolean,
> = string extends TPart
  ? TEmbedded extends true ? TKey : string
  : TPart extends `${infer THead}_${infer TTail}`
    ? `${RenamePatternPart<THead, TKey, true>}_${RenamePatternPart<TTail, TKey, true>}`
    : TPart;

type RenamePattern<TPattern extends string, TKey extends string> =
  RenamePatternPart<TPattern, TKey, false>;

type RenameResult<TColumns extends QueryColumns, TPattern extends string> = {
  [K in StringKeyOf<TColumns> as RenamePattern<TPattern, K>]: TColumns[K];
};

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

export type DropResultInternal<
  TColumns extends QueryColumns,
  TNames extends readonly string[],
> = DropResult<TColumns, TNames>;

export function pick<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<PickResult<TColumns, TNames>> {
  return typedProjectionStep("pick", (query: Query<QueryColumns>) => map((input: ColumnRefs<QueryColumns>) => {
    assertKnownColumns(input, names);
    return selectColumnsByName(input, names);
  })(query));
}

export function drop<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<DropResult<TColumns, TNames>> {
  return typedProjectionStep("drop", (query: Query<QueryColumns>) => {
    const state = getQueryState(query);
    assertKnownColumns(query.columns as ColumnRefs<QueryColumns>, names);
    const dropped = new Set<string>(names);
    const kept = state.columnNames.filter((name: string) => !dropped.has(name));

    return map((input: ColumnRefs<QueryColumns>) => {
      return selectColumnsByName(input, kept);
    })(query);
  });
}

export function rename<const TPattern extends string>(
  renameKey: (key: string) => TPattern
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
) => Query<RenameResult<TColumns, TPattern>> {
  return typedProjectionStep("rename", (query: Query<QueryColumns>) => map((input: ColumnRefs<QueryColumns>) => {
    return mapColumnNames(input, getQueryState(query).columnNames, renameKey);
  })(query));
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
  return createQueryStep("extend", (query: Query<QueryColumns>) => {
    const state = getQueryState(query);
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...selectColumnsByName(cols, state.columnNames),
      ...resolveExtensionShape(selector(cols)),
    }))(query);
  });
}

export function extendInternal<
  TColumns extends QueryColumns,
  const TName extends string,
  TValue extends ProjectionValue,
>(
  name: TName,
  selector: (cols: ColumnRefs<TColumns>) => TValue
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, { [K in TName]: ProjectionValueResult<TValue> }>> {
  const resolvedSelector = resolveExtendSelector(
    name,
    eraseProjectionSelector(selector)
  );
  return typedProjectionStep("extendInternal", (query: Query<QueryColumns>) => {
    const state = getQueryState(query);
    const cols = query.columns as ColumnRefs<QueryColumns>;
    const selection = {
      ...selectColumnsByName(cols, state.columnNames),
      ...resolveExtensionShape(resolvedSelector(cols), { allowReservedKeys: true }),
    };
    return deriveQuery(query, resolveMapQuery(state, selection));
  });
}

export function dropInternal<
  TColumns extends QueryColumns,
  const TNames extends readonly string[],
>(
  query: Query<TColumns>,
  names: TNames
): Query<DropResult<TColumns, TNames>> {
  const state = getQueryState(query);
  assertKnownColumns(query.columns as ColumnRefs<QueryColumns>, names);
  const dropped = new Set<string>(names);
  const kept = state.columnNames.filter((name: string) => !dropped.has(name));
  const selection = selectColumnsByName(
    query.columns as ColumnRefs<QueryColumns>,
    kept
  );
  return deriveQuery(query, resolveMapQuery(state, selection)) as Query<DropResult<TColumns, TNames>>;
}

export type InternalExtendedColumns<
  TColumns extends QueryColumns,
  TName extends string,
  TValue extends ProjectionValue,
> = ExtendResult<TColumns, { [K in TName]: ProjectionValueResult<TValue> }>;

export function filterInternal<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: Expr<boolean | null>
): Query<TColumns> {
  return deriveQuery(query, resolveFilterQuery(getQueryState(query), predicate.node));
}

function resolveExtendSelector(
  name: string,
  selector: (cols: ColumnRefs<QueryColumns>) => ProjectionValue
): (cols: ColumnRefs<QueryColumns>) => ProjectionShape {
  return (cols) => ({ [name]: selector(cols) });
}

function resolveExtensionShape(
  value: unknown,
  options: { allowReservedKeys?: boolean } = {}
): ProjectionShape {
  assertProjectionShape(value, options);
  return value;
}

function eraseProjectionSelector<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => ProjectionValue
): (cols: ColumnRefs<QueryColumns>) => ProjectionValue {
  return selector as unknown as (cols: ColumnRefs<QueryColumns>) => ProjectionValue;
}

function typedProjectionStep<TInput extends QueryColumns, TOutput extends QueryColumns>(
  name: string,
  apply: (query: Query<QueryColumns>) => Query<QueryColumns>
): GenericQueryStep<TInput, TOutput> {
  return eraseProjectionStep(createQueryStep(name, apply));
}

function eraseProjectionStep<TInput extends QueryColumns, TOutput extends QueryColumns>(
  step: GenericQueryStep<QueryColumns, QueryColumns>
): GenericQueryStep<TInput, TOutput> {
  return step as unknown as GenericQueryStep<TInput, TOutput>;
}
