import type { SqlBoolean, SqlInt, SqlString } from "../../types.ts";
import type { SqlExpressionValue, SqlValue } from "../../../type_system.ts";
import {
  unsafeFn,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
} from "../core.ts";

type ArrayInput = readonly SqlValue[] | SqlString | null;
type SqlExprValue<T> = SqlExpressionValue<ExprInputValue<T>>;
type ArrayElement<T> = [T] extends [never]
  ? never
  : Exclude<SqlExprValue<T>, null> extends readonly (infer TItem)[]
    ? TItem
    : SqlValue;
type ArrayValue<T> = readonly ArrayElement<T>[];
type NullPropagatingArrayResult<TArray, TResult> = PropagateNull<SqlExprValue<TArray>, TResult>;
type ArrayWithItem<TArray, TItem> = readonly (
  ArrayElement<TArray> | Extract<SqlExprValue<TItem>, null>
)[];

export function arrayLength<TInput extends ExprInput<ArrayInput>>(
  value: TInput
): Expr<NullPropagatingArrayResult<TInput, SqlInt>> {
  return unsafeFn<NullPropagatingArrayResult<TInput, SqlInt>>("ARRAY_LENGTH", value);
}

export function arrayContains<
  TInput extends ExprInput<ArrayInput>,
  TItem extends ExprInput<ArrayElement<TInput> | null>,
>(
  value: TInput,
  item: TItem
): Expr<PropagateNull<SqlExprValue<TInput> | SqlExprValue<TItem>, SqlBoolean>> {
  return unsafeFn<PropagateNull<SqlExprValue<TInput> | SqlExprValue<TItem>, SqlBoolean>>(
    "ARRAY_CONTAINS",
    value,
    item
  );
}

export function arrayPosition<
  TInput extends ExprInput<ArrayInput>,
  TItem extends ExprInput<ArrayElement<TInput> | null>,
>(
  value: TInput,
  item: TItem
): Expr<SqlInt | null> {
  return unsafeFn<SqlInt | null>("ARRAY_POSITION", value, item);
}

export function arraySlice<
  TInput extends ExprInput<ArrayInput>,
>(
  value: TInput,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): Expr<NullPropagatingArrayResult<TInput, ArrayValue<TInput>>> {
  const args: ExprInput<unknown>[] = [value, start];
  if (length !== undefined) args.push(length);
  return unsafeFn<NullPropagatingArrayResult<TInput, ArrayValue<TInput>>>("ARRAY_SLICE", ...args);
}

export function arrayJoin<TInput extends ExprInput<ArrayInput>, TSeparator extends ExprInput<string | null>>(
  value: TInput,
  separator: TSeparator
): Expr<PropagateNull<SqlExprValue<TInput> | SqlExprValue<TSeparator>, SqlString>> {
  return unsafeFn<PropagateNull<SqlExprValue<TInput> | SqlExprValue<TSeparator>, SqlString>>("ARRAY_JOIN", value, separator);
}

export function arrayAppend<
  TInput extends ExprInput<ArrayInput>,
  TItem extends ExprInput<ArrayElement<TInput> | null>,
>(
  value: TInput,
  item: TItem
): Expr<NullPropagatingArrayResult<TInput | TItem, ArrayWithItem<TInput, TItem>>> {
  return unsafeFn<NullPropagatingArrayResult<TInput | TItem, ArrayWithItem<TInput, TItem>>>("ARRAY_APPEND", value, item);
}

export function arrayPrepend<
  TInput extends ExprInput<ArrayInput>,
  TItem extends ExprInput<ArrayElement<TInput> | null>,
>(
  value: TInput,
  item: TItem
): Expr<NullPropagatingArrayResult<TInput | TItem, ArrayWithItem<TInput, TItem>>> {
  return unsafeFn<NullPropagatingArrayResult<TInput | TItem, ArrayWithItem<TInput, TItem>>>("ARRAY_PREPEND", value, item);
}

export function arrayConcat<
  TInput extends ExprInput<ArrayInput>,
  const TValues extends readonly ExprInput<ArrayInput>[],
>(
  value: TInput,
  ...values: TValues
): Expr<NullPropagatingArrayResult<
  TInput | TValues[number],
  readonly (ArrayElement<TInput> | ArrayElement<TValues[number]>)[]
>> {
  type Result = NullPropagatingArrayResult<
    TInput | TValues[number],
    readonly (ArrayElement<TInput> | ArrayElement<TValues[number]>)[]
  >;
  if (values.length === 0) {
    return wrapExpr(value) as Expr<Result>;
  }
  return unsafeFn<Result>("ARRAY_CONCAT", value, ...values);
}

export function arrayDistinct<TInput extends ExprInput<ArrayInput>>(
  value: TInput
): Expr<NullPropagatingArrayResult<TInput, readonly ArrayElement<TInput>[]>> {
  return unsafeFn<NullPropagatingArrayResult<TInput, readonly ArrayElement<TInput>[]>>("ARRAY_DISTINCT", value);
}
