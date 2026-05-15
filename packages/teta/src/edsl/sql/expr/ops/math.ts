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
): ExprRef<NumericBinaryResult<TLeft, TRight>>;
export function add<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>> {
  return binaryExpr(
    "+",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>>;
}

export function sub<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>>;
export function sub<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>> {
  return binaryExpr(
    "-",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>>;
}

export function mul<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>>;
export function mul<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>> {
  return binaryExpr(
    "*",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>>;
}

export function div<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>>;
export function div<TLeft extends ExprInput<NullableSqlNumber>, TRight extends ExprInput<NullableSqlNumber>>(
  left: TLeft,
  right: TRight
): ExprRef<NumericBinaryResult<TLeft, TRight>> {
  return binaryExpr(
    "/",
    toExprNode(left),
    toExprNode(right)
  ) as ExprRef<NumericBinaryResult<TLeft, TRight>>;
}

export function mod<TValue extends NullableSqlNumber, TLeft extends ExprInput<TValue>, TRight extends ExprInput<TValue>>(
  left: TLeft,
  right: TRight
): ExprRef<TValue> {
  return fn<TValue, [TLeft, TRight]>("MOD", left, right);
}

export function ceil<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("CEIL", value);
}

export function floor<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return fn<PropagateNull<ExprInputValue<TInput>, SqlInt>, [TInput]>("FLOOR", value);
}

export function abs<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<ExprInputValue<TInput>> {
  return fn<ExprInputValue<TInput>, [TInput]>("ABS", value);
}

export function sqrt<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlFloat>> {
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
): ExprRef<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TExponentInput>, SqlFloat>> {
  return fn<PropagateNull<ExprInputValue<TInput> | ExprInputValue<TExponentInput>, SqlFloat>, [TInput, TExponentInput]>(
    "POWER",
    value,
    exponent
  );
}

export function greatest<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>, const TValues extends readonly ExprInput<TValue>[]>(
  value: TInput,
  ...values: TValues
): ExprRef<TValue> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "greatest requires at least one value");
  }
  return fn<TValue, [TInput, ...TValues]>("GREATEST", value, ...values);
}

export function least<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>, const TValues extends readonly ExprInput<TValue>[]>(
  value: TInput,
  ...values: TValues
): ExprRef<TValue> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "least requires at least one value");
  }
  return fn<TValue, [TInput, ...TValues]>("LEAST", value, ...values);
}

export function cast<TTarget = unknown, TInput extends ExprInput<unknown> = ExprInput<unknown>>(
  value: TInput,
  target: string
): ExprRef<TTarget> {
  if (!target.trim()) {
    userError("INVALID_FUNCTION_NAME", "cast requires a target type");
  }
  return new ExprRef<TTarget>({
    kind: "cast",
    expr: toExprNode(value as ExprInput<unknown>),
    target,
  });
}

export function toInt<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlInt>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlInt>, TInput>(value, "INTEGER");
}

export function toFloat<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, SqlFloat>> {
  return cast<PropagateNull<ExprInputValue<TInput>, SqlFloat>, TInput>(value, "FLOAT");
}

export function toString<TInput extends ExprInput<unknown>>(
  value: TInput
): ExprRef<PropagateNull<ExprInputValue<TInput>, string>> {
  return cast<PropagateNull<ExprInputValue<TInput>, string>, TInput>(value, "VARCHAR");
}

export function round<
  TValue extends NullableSqlNumber,
  TInput extends ExprInput<TValue>,
  TScale extends ExprInput<SqlInt> | undefined = undefined,
>(
  value: TInput,
  scale?: TScale
): ExprRef<ExprInputValue<TInput>> {
  if (scale === undefined) {
    return fn<ExprInputValue<TInput>, [TInput]>("ROUND", value);
  }
  return fn<ExprInputValue<TInput>, [TInput, NonNullable<TScale>]>(
    "ROUND",
    value,
    scale as NonNullable<TScale>
  );
}
