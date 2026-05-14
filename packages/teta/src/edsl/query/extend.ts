import { map, Query } from "./builder.ts";
import type {
  ColumnRefs,
  ProjectionResult,
  ProjectionShape,
  ProjectionValue,
} from "../expr.ts";
import { userError } from "../errors.ts";
import type {
  CurrentDeferredProjectionResult,
  KnownDeferredCurrentSelectionGuard,
  QueryColumns,
} from "./deferred_types.ts";
import { selectColumnsByName } from "./projection_utils.ts";

type StringKeyOf<T> = Extract<keyof T, string>;

type DeferredProjectionShapeInput<TSelection extends Record<string, unknown>> = {
  [K in keyof TSelection]: [NonNullable<TSelection[K]>] extends [never]
    ? never
    : NonNullable<TSelection[K]> extends ProjectionValue
      ? TSelection[K]
      : never;
};

type DefinedProjectionShape<TSelection extends Record<string, unknown>> = {
  [K in keyof TSelection]: Exclude<TSelection[K], undefined> extends ProjectionValue
    ? Exclude<TSelection[K], undefined>
    : never;
};

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

type NonCallableSelection<TSelection> = TSelection & {
  readonly apply?: never;
  readonly bind?: never;
  readonly call?: never;
};

export function extend<const Sel extends Record<string, unknown>>(
  selection: NonCallableSelection<Sel> & DeferredProjectionShapeInput<Sel>
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentSelectionGuard<NoInfer<TColumns>, Sel>
) => Query<ExtendResult<TColumns, CurrentDeferredProjectionResult<TColumns, DefinedProjectionShape<Sel>>>>;

export function extend<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, ProjectionResult<Sel>>>;

export function extend(...args: unknown[]): unknown {
  if (args[0] instanceof Query) {
    userError(
      "QUERY_HELPER_CURRIED_ONLY",
      "extend() is curried-only. Use pipe(query, extend(selector))."
    );
  }

  const [selectorOrSelection] = args;
  return (query: Query<QueryColumns>) => {
    if (typeof selectorOrSelection === "function") {
      return map((cols: ColumnRefs<QueryColumns>) => ({
        ...currentColumns(cols, query.columnNames),
        ...(selectorOrSelection as (cols: ColumnRefs<QueryColumns>) => ProjectionShape)(cols),
      }))(query);
    }

    return map({
      ...currentColumns(query.columns as ColumnRefs<QueryColumns>, query.columnNames),
      ...(selectorOrSelection as ProjectionShape),
    })(query);
  };
}

function currentColumns(
  cols: ColumnRefs<QueryColumns>,
  columnNames: readonly string[]
): ReturnType<typeof selectColumnsByName> {
  return selectColumnsByName(cols, columnNames);
}
