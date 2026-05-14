import type {
  DeferredExprDepsOf,
} from "../internal_deferred_expr.ts";
import type { ExprRef, ProjectionValueResult } from "../expr.ts";

export type QueryColumns = Record<string, any>;

export type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

export type LeftDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { left?: infer TLeft }
  ? TLeft
  : Record<never, never>;

export type RightDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { right?: infer TRight }
  ? TRight
  : Record<never, never>;

export type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

export type SingleLiteralKey<TDeps> = LiteralDeferredKeys<TDeps> extends infer TKey extends string
  ? [TKey] extends [never]
    ? never
    : TKey
  : never;

export type ColumnValueForKey<TColumns extends QueryColumns, TKey> =
  [TKey] extends [never]
    ? never
    : TKey extends keyof TColumns
      ? TColumns[TKey & keyof TColumns]
      : never;

export type ColumnValuesForKeys<TColumns extends QueryColumns, TKeys> =
  TKeys extends keyof TColumns ? TColumns[TKeys] : never;

export type KnownDeferredCurrentColumnsGuard<
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

export type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

export type KnownDeferredCurrentSelectionGuard<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = UnionToIntersection<{
  [K in keyof TSelection]: KnownDeferredCurrentColumnsGuard<TColumns, TSelection[K]>;
}[keyof TSelection]>;

export type CurrentDeferredExprValue<TColumns extends QueryColumns, TExpr> =
  TExpr extends ExprRef<never>
    ? ColumnValueForKey<TColumns, SingleLiteralKey<CurrentDepsOf<TExpr>>>
    : TExpr extends ExprRef<infer TValue>
      ? TValue
      : ProjectionValueResult<TExpr>;

export type CurrentDeferredProjectionResult<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = {
  [K in keyof TSelection]: CurrentDeferredExprValue<TColumns, Exclude<TSelection[K], undefined>>;
};
