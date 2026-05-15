import type { NormalizeNumericLiteral, SqlFloat, SqlInt, SqlNumber } from "../../types.ts";
import {
  ExprRef,
  binaryExpr,
  fn,
  toExprNode,
  type ExprInput,
  type ExprInputValue,
  type PropagateNull,
} from "../core.ts";
import type { DeferredExprDepsForArgs } from "../../../internal_deferred_expr.ts";
import { userError } from "../../../errors.ts";

type NullableSqlNumber = SqlNumber | number | bigint | null;
type NumericBinaryResult<
  TLeft extends ExprInput<NullableSqlNumber>,
  TRight extends ExprInput<NullableSqlNumber>,
> =
  | NormalizeNumericLiteral<ExprInputValue<TLeft>, ExprInputValue<TRight>>
  | NormalizeNumericLiteral<ExprInputValue<TRight>, ExprInputValue<TLeft>>;

export function add<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
export function add<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "+",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function sub<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
export function sub<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "-",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function mul<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
export function mul<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "*",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function div<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
export function div<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "/",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function mod<TValue extends NullableSqlNumber, TLeft extends ExprInput<TValue>, TRight extends ExprInput<TValue>>(
  left: TLeft,
  right: TRight
): ExprRef<TValue, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return fn<TValue, [TLeft, TRight]>("MOD", left, right);
}

export function ceil<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>, DeferredExprDepsForArgs<[TInput]>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CEIL", value);
}

export function floor<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>, DeferredExprDepsForArgs<[TInput]>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("FLOOR", value);
}

export function abs<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<ExprInputValue<TInput>, DeferredExprDepsForArgs<[TInput]>> {
  return fn<ExprInputValue<TInput>, [TInput]>("ABS", value);
}

export function sqrt<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlFloat>, DeferredExprDepsForArgs<[TInput]>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlFloat>, [TInput]>("SQRT", value);
}

export function pow<
  TValue extends NullableSqlNumber,
  TExponent extends NullableSqlNumber,
  TInput extends ExprInput<TValue>,
  TExponentInput extends ExprInput<TExponent>,
>(
  value: TInput,
  exponent: TExponentInput
): ExprRef<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TExponentInput>, SqlFloat>, DeferredExprDepsForArgs<[TInput, TExponentInput]>> {
  return fn<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TExponentInput>, SqlFloat>, [TInput, TExponentInput]>(
    "POWER",
    value,
    exponent
  );
}

export function greatest<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>, const TValues extends readonly ExprInput<TValue>[]>(
  value: TInput,
  ...values: TValues
): ExprRef<TValue, DeferredExprDepsForArgs<[TInput, ...TValues]>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "greatest requires at least one value");
  }
  return fn<TValue, [TInput, ...TValues]>("GREATEST", value, ...values);
}

export function least<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>, const TValues extends readonly ExprInput<TValue>[]>(
  value: TInput,
  ...values: TValues
): ExprRef<TValue, DeferredExprDepsForArgs<[TInput, ...TValues]>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "least requires at least one value");
  }
  return fn<TValue, [TInput, ...TValues]>("LEAST", value, ...values);
}

export function cast<TTarget = unknown, TInput extends ExprInput<unknown> = ExprInput<unknown>>(
  value: TInput,
  target: string
): ExprRef<TTarget, DeferredExprDepsForArgs<[TInput]>> {
  if (!target.trim()) {
    userError("INVALID_FUNCTION_NAME", "cast requires a target type");
  }
  return new ExprRef<TTarget, DeferredExprDepsForArgs<[TInput]>>({
    kind: "cast",
    expr: toExprNode(value as ExprInput<unknown>),
    target,
  });
}

export function toInt<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>, DeferredExprDepsForArgs<[TInput]>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlInt>, TInput>(value, "INTEGER");
}

export function toFloat<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlFloat>, DeferredExprDepsForArgs<[TInput]>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlFloat>, TInput>(value, "FLOAT");
}

export function toString<TInput extends ExprInput<unknown>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>, DeferredExprDepsForArgs<[TInput]>> {
  return cast<PropagateNull<ExprInputValue<TInput>, string>, TInput>(value, "VARCHAR");
}

export function round<
  TValue extends NullableSqlNumber,
  TInput extends ExprInput<TValue>,
  TScale extends ExprInput<SqlInt> | undefined = undefined,
>(
  value: TInput,
  scale?: TScale
): ExprRef<ExprInputValue<TInput>, DeferredExprDepsForArgs<[TInput, TScale]>> {
  if (scale === undefined) {
    return fn<ExprInputValue<TInput>, [TInput]>("ROUND", value) as unknown as ExprRef<
      ExprInputValue<TInput>,
      DeferredExprDepsForArgs<[TInput, TScale]>
    >;
  }
  return fn<ExprInputValue<TInput>, [TInput, NonNullable<TScale>]>(
    "ROUND",
    value,
    scale as NonNullable<TScale>
  ) as unknown as ExprRef<ExprInputValue<TInput>, DeferredExprDepsForArgs<[TInput, TScale]>>;
}
