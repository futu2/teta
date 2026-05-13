import { map, Query } from "./builder.ts";
import type {
  ColumnRef,
  ColumnRefs,
  DeferredExprDepsOf,
  ExprRef,
  ProjectionResult,
  ProjectionShape,
  ProjectionValue,
  ProjectionValueResult,
} from "../expr.ts";
import { userError } from "../errors.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LeftDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { left?: infer TLeft }
  ? TLeft
  : Record<never, never>;

type RightDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { right?: infer TRight }
  ? TRight
  : Record<never, never>;

type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

type KnownDeferredCurrentColumnsGuard<
  TColumns extends QueryColumns,
  TExpr,
> = ([Exclude<LiteralDeferredKeys<CurrentDepsOf<TExpr>>, keyof TColumns>] extends [never]
    ? unknown
    : {
        __teta_unknown_deferred_current_columns__: Exclude<
          LiteralDeferredKeys<CurrentDepsOf<TExpr>>,
          keyof TColumns
        >;
      })
  & ([LiteralDeferredKeys<LeftDepsOf<TExpr>> | LiteralDeferredKeys<RightDepsOf<TExpr>>] extends [never]
    ? unknown
    : {
        __teta_invalid_deferred_current_scope_columns__:
          | LiteralDeferredKeys<LeftDepsOf<TExpr>>
          | LiteralDeferredKeys<RightDepsOf<TExpr>>;
      });

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

type KnownDeferredCurrentSelectionGuard<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = UnionToIntersection<{
  [K in keyof TSelection]: KnownDeferredCurrentColumnsGuard<TColumns, TSelection[K]>;
}[keyof TSelection]>;

type ColumnValueForKey<TColumns extends QueryColumns, TKey> =
  [TKey] extends [never]
    ? never
    : TKey extends keyof TColumns
      ? TColumns[TKey & keyof TColumns]
      : never;

type SingleLiteralKey<TDeps> = LiteralDeferredKeys<TDeps> extends infer TKey extends string
  ? [TKey] extends [never]
    ? never
    : TKey
  : never;

type CurrentDeferredExprValue<TColumns extends QueryColumns, TExpr> =
  TExpr extends ExprRef<never>
    ? ColumnValueForKey<TColumns, SingleLiteralKey<CurrentDepsOf<TExpr>>>
    : TExpr extends ExprRef<infer TValue>
      ? TValue
      : ProjectionValueResult<TExpr>;

type CurrentDeferredProjectionResult<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = {
  [K in keyof TSelection]: CurrentDeferredExprValue<TColumns, Exclude<TSelection[K], undefined>>;
};

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
): Record<string, ColumnRef<any, string>> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const name of columnNames) {
    result[name] = Reflect.get(cols, name) as ColumnRef<any, string>;
  }
  return result;
}
