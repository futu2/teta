import {
  createQueryStep,
  getQueryState,
  type Query,
} from "../query/core.ts";
import { deriveQuery } from "../query/derive.ts";
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
  selectColumnsByName,
} from "../query/projection_utils.ts";
import type { QueryColumns } from "../query/types.ts";
type StringKeyOf<T> = Extract<keyof T, string>;
type GenericQueryStep<TInput extends QueryColumns, TOutput extends QueryColumns> =
  (query: Query<TInput>) => Query<TOutput>;

type DropResult<
  TColumns extends QueryColumns,
  TNames extends readonly string[],
> = {
  [K in Exclude<StringKeyOf<TColumns>, TNames[number]>]: TColumns[K];
};

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

export type DropResultInternal<
  TColumns extends QueryColumns,
  TNames extends readonly string[],
> = DropResult<TColumns, TNames>;

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
