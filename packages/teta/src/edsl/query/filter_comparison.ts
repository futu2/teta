import { filter, Query } from "./builder.ts";
import type { QueryStep } from "./builder.ts";
import type {
  ColumnRefs,
  DeferredExprDepsOf,
  ExprInput,
} from "../expr.ts";
import { ExprRef, resolveDeferredExpr } from "../expr.ts";
import { eq, ne, gt, gte, lt, lte } from "../expr.ts";
import type { SqlDate, SqlNumber, SqlTimestamp } from "../sql/types.ts";

type QueryColumns = Record<string, any>;
type ComparableInput = SqlNumber | number | bigint | SqlDate | SqlTimestamp | null;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type NotFunction<T> = IsAny<T> extends true
  ? never
  : T extends (...args: any[]) => any
    ? never
    : unknown;
type DirectOperand<TValue> = ExprInput<TValue>;
type CallableOperand<TColumns extends QueryColumns, TValue> =
  (cols: ColumnRefs<TColumns>) => ExprInput<TValue>;
type CompatibleDirectOperand<TValue> = ExprInput<NonNullWidenLiteral<TValue> | Extract<TValue, null>>;
type Operand<TColumns extends QueryColumns, TValue> =
  | DirectOperand<TValue>
  | CallableOperand<TColumns, TValue>;
type ExprInputValueOf<TExpr> =
  TExpr extends ExprRef<infer TValue, any> ? TValue
  : TExpr extends ExprInput<infer TValue> ? TValue
  : never;
type WidenLiteral<T> =
  T extends string ? string
  : T extends number ? number
  : T extends bigint ? bigint
  : T extends boolean ? boolean
  : T;
type NonNullWidenLiteral<T> = WidenLiteral<Exclude<T, null>>;
type SameComparableValue<TLeft, TRight> =
  [NonNullWidenLiteral<TLeft>] extends [NonNullWidenLiteral<TRight>]
    ? [NonNullWidenLiteral<TRight>] extends [NonNullWidenLiteral<TLeft>]
      ? unknown
      : never
    : never;
type SameExprInputValue<TLeft extends ExprInput<unknown>, TRight extends ExprInput<unknown>> =
  IsNever<ExprInputValueOf<TLeft>> extends true ? unknown
  : IsNever<ExprInputValueOf<TRight>> extends true ? unknown
  : SameComparableValue<ExprInputValueOf<TLeft>, ExprInputValueOf<TRight>>;
type SameExprInputValueRest<TLeft extends ExprInput<unknown>, TRight extends ExprInput<unknown>> =
  SameExprInputValue<TLeft, TRight> extends never ? [never] : [];
type ComparableExprInput<TInput extends ExprInput<unknown>> =
  Exclude<ExprInputValueOf<TInput>, null> extends ComparableInput ? unknown : never;
type ComparableExprInputRest<TInput extends ExprInput<unknown>> =
  ComparableExprInput<TInput> extends never ? [never] : [];

type IsNever<T> = [T] extends [never] ? true : false;

type SameCurrentValueGuard<
  TColumns extends QueryColumns,
  TLeft,
  TRight,
> = SameComparableValue<CurrentExprInputValue<TColumns, TLeft>, CurrentExprInputValue<TColumns, TRight>> extends never
  ? {
      __teta_mismatched_comparison_operand_types__: [
        CurrentExprInputValue<TColumns, TLeft>,
        CurrentExprInputValue<TColumns, TRight>,
      ];
    }
  : unknown;

type MixedCurrentValueGuard<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<unknown>,
  TRight extends ExprInput<unknown>,
> = SameExprInputValue<TLeft, TRight> extends never
  ? {
      __teta_mismatched_comparison_operand_types__: [
        ExprInputValueOf<TLeft>,
        ExprInputValueOf<TRight>,
      ];
    }
  : SameCurrentValueGuard<TColumns, TLeft, TRight>;

type ComparableCurrentValue<
  TColumns extends QueryColumns,
  TExpr,
> = Exclude<CurrentExprInputValue<TColumns, TExpr>, null> extends ComparableInput
  ? unknown
  : never;

type OrderedComparableCurrentValueGuard<
  TColumns extends QueryColumns,
  TLeft,
  TRight,
> = [ComparableCurrentValue<TColumns, TLeft>] extends [never]
  ? {
      __teta_non_comparable_filter_operand__: [
        CurrentExprInputValue<TColumns, TLeft>,
        CurrentExprInputValue<TColumns, TRight>,
      ];
    }
  : [ComparableCurrentValue<TColumns, TRight>] extends [never]
    ? {
        __teta_non_comparable_filter_operand__: [
          CurrentExprInputValue<TColumns, TLeft>,
          CurrentExprInputValue<TColumns, TRight>,
        ];
      }
  : unknown;
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

type SingleLiteralKey<TDeps> = LiteralDeferredKeys<TDeps> extends infer TKey extends string
  ? [TKey] extends [never]
    ? never
    : TKey
  : never;

type ColumnValueForKey<TColumns extends QueryColumns, TKey> =
  [TKey] extends [never]
    ? never
    : TKey extends keyof TColumns
      ? TColumns[TKey & keyof TColumns]
      : never;

type CurrentExprInputValue<TColumns extends QueryColumns, TExpr> =
  TExpr extends ExprRef<never, any>
    ? ColumnValueForKey<TColumns, SingleLiteralKey<CurrentDepsOf<TExpr>>>
    : ExprInputValueOf<TExpr>;

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

export function filterEq<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<unknown>,
  TRight extends ExprInput<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterEq<TColumns extends QueryColumns, T, TRight extends ExprInput<NoInfer<T>>>(
  left: CallableOperand<TColumns, T>,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, ExprRef<T>, TRight>
) => Query<TColumns>;

export function filterEq<TColumns extends QueryColumns, T, TLeft extends ExprInput<T>>(
  left: TLeft & NotFunction<TLeft>,
  right: CallableOperand<TColumns, NoInfer<T>>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, ExprRef<T>>
) => Query<TColumns>;

export function filterEq<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterEq<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, eq);
}

export function filterNe<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<unknown>,
  TRight extends ExprInput<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterNe<TColumns extends QueryColumns, T, TRight extends ExprInput<NoInfer<T>>>(
  left: CallableOperand<TColumns, T>,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, ExprRef<T>, TRight>
) => Query<TColumns>;

export function filterNe<TColumns extends QueryColumns, T, TLeft extends ExprInput<T>>(
  left: TLeft & NotFunction<TLeft>,
  right: CallableOperand<TColumns, NoInfer<T>>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, ExprRef<T>>
) => Query<TColumns>;

export function filterNe<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterNe<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, ne);
}

export function filterGt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterGt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends DirectOperand<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGt<
  TColumns extends QueryColumns,
  TLeft extends DirectOperand<unknown>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGt<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGt<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, gt);
}

export function filterGte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterGte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends DirectOperand<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGte<
  TColumns extends QueryColumns,
  TLeft extends DirectOperand<unknown>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGte<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterGte<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, gte);
}

export function filterLt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterLt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends DirectOperand<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLt<
  TColumns extends QueryColumns,
  TLeft extends DirectOperand<unknown>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLt<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLt<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, lt);
}

export function filterLte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterLte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends DirectOperand<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TRight>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLte<
  TColumns extends QueryColumns,
  TLeft extends DirectOperand<unknown>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): (
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft>
    & MixedCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLte<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
    & SameCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
    & OrderedComparableCurrentValueGuard<NoInfer<TColumns>, TLeft, TRight>
) => Query<TColumns>;

export function filterLte<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, lte);
}

function comparisonFilter<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>,
  op: (left: ExprInput<T>, right: ExprInput<T>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns> {
  return (query: Query<TColumns>) => {
    const resolvedLeft = resolveOperand(query, left);
    const resolvedRight = resolveOperand(query, right);
    return filter(op(resolvedLeft, resolvedRight))(query);
  };
}

function resolveOperand<TColumns extends QueryColumns, T>(
  query: Query<TColumns>,
  operand: Operand<TColumns, T>
): ExprInput<T> {
  const value = isCallableOperand(operand)
    ? operand(query.columns)
    : operand;
  return value instanceof ExprRef
    ? resolveDeferredExpr(value, {
        current: {
          label: "current row",
          columns: query.columns as ColumnRefs<Record<string, any>>,
          columnNames: query.columnNames,
        },
      }) as ExprInput<T>
    : value;
}

function isCallableOperand<TColumns extends QueryColumns, T>(
  operand: Operand<TColumns, T>
): operand is CallableOperand<TColumns, T> {
  return typeof operand === "function";
}
