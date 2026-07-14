import type {
  NormalizeExpressionLiteral,
  SqlBoolean,
  SqlDate,
  SqlNumber,
  SqlString,
  SqlTimestamp,
  SqlUuid,
} from "../../types.ts";
import type { ExprNode, OrderItem } from "../../../core/types.ts";
import {
  binaryExpr,
  exprOf,
  toExprNode,
  wrapExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
} from "../core.ts";
import { userError } from "../../../errors.ts";

type ComparableInput = SqlNumber | number | bigint | SqlDate | SqlTimestamp | null;
type StringComparable = SqlString | SqlDate | SqlTimestamp | SqlUuid;
type ComparableValue<T> = NormalizeExpressionLiteral<Exclude<ExprInputValue<T>, null>>;
type ComparableDomain<T> = T extends StringComparable ? string : T;
type CompatibleExprInput<TLeft, TRight> =
  [ComparableDomain<ComparableValue<TLeft>>] extends [ComparableDomain<ComparableValue<TRight>>]
    ? unknown
    : [ComparableDomain<ComparableValue<TRight>>] extends [ComparableDomain<ComparableValue<TLeft>>]
      ? unknown
      : never;
type PredicateResult<TValue> = null extends TValue ? SqlBoolean | null : SqlBoolean;
type BinaryPredicateResult<TLeft, TRight> = PredicateResult<
  ExprInputValue<TLeft> | ExprInputValue<TRight>
>;
type CompatibleInputList<TValue, TValues extends readonly unknown[]> =
  TValues extends readonly [infer THead, ...infer TTail]
    ? THead extends ExprInput<unknown>
      ? CompatibleExprInput<TValue, THead> extends never
        ? never
        : CompatibleInputList<TValue, TTail>
      : never
    : unknown;

export function eq<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function ne<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "!=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function gt<
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    ">",
    toExprNode(left as ExprInput<ComparableInput>),
    toExprNode(right as ExprInput<ComparableInput>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function gte<
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    ">=",
    toExprNode(left as ExprInput<ComparableInput>),
    toExprNode(right as ExprInput<ComparableInput>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function lt<
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "<",
    toExprNode(left as ExprInput<ComparableInput>),
    toExprNode(right as ExprInput<ComparableInput>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function lte<
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "<=",
    toExprNode(left as ExprInput<ComparableInput>),
    toExprNode(right as ExprInput<ComparableInput>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function like<TLeft extends ExprInput<string | null>, TRight extends ExprInput<string>>(
  left: TLeft,
  right: TRight
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "LIKE",
    toExprNode(left as ExprInput<string | null>),
    toExprNode(right as ExprInput<string>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function isIn<
  TValue extends ExprInput<unknown>,
  const TValues extends readonly [ExprInput<unknown>, ...ExprInput<unknown>[]],
>(
  value: TValue,
  values: TValues & CompatibleInputList<TValue, TValues>
): Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "in requires at least one value");
  }
  return binaryExpr("IN", toExprNode(value as ExprInput<unknown>), {
    kind: "list",
    items: values.map((item) => toExprNode(item as ExprInput<unknown>)),
  }) as Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>>;
}

export function isNotIn<
  TValue extends ExprInput<unknown>,
  const TValues extends readonly [ExprInput<unknown>, ...ExprInput<unknown>[]],
>(
  value: TValue,
  values: TValues & CompatibleInputList<TValue, TValues>
): Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "notIn requires at least one value");
  }
  return binaryExpr("NOT IN", toExprNode(value as ExprInput<unknown>), {
    kind: "list",
    items: values.map((item) => toExprNode(item as ExprInput<unknown>)),
  }) as Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>>;
}

export const notIn = isNotIn;

export function between<
  TValue extends ExprInput<ComparableInput>,
  TLower extends ExprInput<ComparableInput>,
  TUpper extends ExprInput<ComparableInput>,
>(
  value: TValue,
  lower: TLower & CompatibleExprInput<TValue, TLower>,
  upper: TUpper & CompatibleExprInput<TValue, TUpper>
): Expr<PredicateResult<
  ExprInputValue<TValue> | ExprInputValue<TLower> | ExprInputValue<TUpper>
>> {
  return binaryExpr(
    "BETWEEN",
    toExprNode(value as ExprInput<ComparableInput>),
    {
      kind: "binary",
      op: "AND",
      left: toExprNode(lower as ExprInput<ComparableInput>),
      right: toExprNode(upper as ExprInput<ComparableInput>),
    }
  ) as Expr<PredicateResult<
    ExprInputValue<TValue> | ExprInputValue<TLower> | ExprInputValue<TUpper>
  >>;
}

export function isDistinctFrom<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight & CompatibleExprInput<TLeft, TRight>
): Expr<SqlBoolean> {
  return binaryExpr(
    "IS DISTINCT FROM",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<SqlBoolean>;
}

type BooleanInput = ExprInput<boolean | SqlBoolean | null>;
type NonEmptyBooleanInputs = readonly [BooleanInput, ...BooleanInput[]];
type BooleanChainResult<TValues extends readonly BooleanInput[]> =
  null extends ExprInputValue<TValues[number]> ? SqlBoolean | null : SqlBoolean;

export function and<const TValues extends NonEmptyBooleanInputs>(
  ...values: TValues
): Expr<BooleanChainResult<TValues>> {
  return booleanChain("AND", "and", values) as Expr<BooleanChainResult<TValues>>;
}

export function or<const TValues extends NonEmptyBooleanInputs>(
  ...values: TValues
): Expr<BooleanChainResult<TValues>> {
  return booleanChain("OR", "or", values) as Expr<BooleanChainResult<TValues>>;
}

function booleanChain(
  op: "AND" | "OR",
  name: "and" | "or",
  values: readonly BooleanInput[]
): Expr<SqlBoolean | null> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", `${name} requires at least one expression`);
  }
  if (values.length === 1) {
    return wrapExpr(values[0] as BooleanInput) as Expr<SqlBoolean | null>;
  }

  let current = toExprNode(values[0] as BooleanInput);
  for (const value of values.slice(1)) {
    current = booleanBinaryNode(op, current, toExprNode(value as BooleanInput));
  }
  return exprOf<SqlBoolean | null>(booleanChainNode(current));
}

function booleanChainNode(
  node: ExprNode<boolean | SqlBoolean | null>
): ExprNode<SqlBoolean | null> {
  return node as ExprNode<SqlBoolean | null>;
}

function booleanBinaryNode(
  op: "AND" | "OR",
  left: ExprNode<boolean | SqlBoolean | null>,
  right: ExprNode<boolean | SqlBoolean | null>
): ExprNode<SqlBoolean | null> {
  return {
    kind: "binary",
    op,
    left,
    right,
  } as ExprNode<SqlBoolean | null>;
}

export function not<TValue extends ExprInput<boolean | SqlBoolean | null>>(
  value: TValue
): Expr<PredicateResult<ExprInputValue<TValue>>> {
  return exprOf<PredicateResult<ExprInputValue<TValue>>>({
    kind: "unary",
    op: "NOT",
    expr: toExprNode(value as ExprInput<boolean | SqlBoolean | null>),
  });
}

export function isNull<TValue extends ExprInput<unknown>>(
  value: TValue
): Expr<SqlBoolean> {
  return binaryExpr(
    "IS",
    toExprNode(value as ExprInput<unknown>),
    toExprNode(null)
  ) as Expr<SqlBoolean>;
}

export function isNotNull<TValue extends ExprInput<unknown>>(
  value: TValue
): Expr<SqlBoolean> {
  return binaryExpr(
    "IS NOT",
    toExprNode(value as ExprInput<unknown>),
    toExprNode(null)
  ) as Expr<SqlBoolean>;
}

export function asc<TValue extends ExprInput<unknown>>(
  value: TValue
): OrderItem {
  return { expr: toExprNode(value as ExprInput<unknown>), direction: "ASC" };
}

export function desc<TValue extends ExprInput<unknown>>(
  value: TValue
): OrderItem {
  return { expr: toExprNode(value as ExprInput<unknown>), direction: "DESC" };
}
