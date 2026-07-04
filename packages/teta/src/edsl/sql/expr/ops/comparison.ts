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

export function gt<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    ">",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function gte<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    ">=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function lt<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "<",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as Expr<BinaryPredicateResult<TLeft, TRight>>;
}

export function lte<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): Expr<BinaryPredicateResult<TLeft, TRight>> {
  return binaryExpr(
    "<=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
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

export function isIn<T, TValue extends ExprInput<T>, const TValues extends readonly ExprInput<T>[]>(
  value: TValue,
  values: TValues
): Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "in requires at least one value");
  }
  return binaryExpr("IN", toExprNode(value as ExprInput<T>), {
    kind: "list",
    items: values.map((item) => toExprNode(item as ExprInput<T>)),
  }) as Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>>;
}

export function isNotIn<T, TValue extends ExprInput<T>, const TValues extends readonly ExprInput<T>[]>(
  value: TValue,
  values: TValues
): Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "notIn requires at least one value");
  }
  return binaryExpr("NOT IN", toExprNode(value as ExprInput<T>), {
    kind: "list",
    items: values.map((item) => toExprNode(item as ExprInput<T>)),
  }) as Expr<PredicateResult<ExprInputValue<TValue> | ExprInputValue<TValues[number]>>>;
}

export const notIn = isNotIn;

export function between<
  T extends ComparableInput,
  TValue extends ExprInput<T>,
  TLower extends ExprInput<T>,
  TUpper extends ExprInput<T>,
>(
  value: TValue,
  lower: TLower,
  upper: TUpper
): Expr<PredicateResult<
  ExprInputValue<TValue> | ExprInputValue<TLower> | ExprInputValue<TUpper>
>> {
  return binaryExpr(
    "BETWEEN",
    toExprNode(value as ExprInput<T>),
    {
      kind: "binary",
      op: "AND",
      left: toExprNode(lower as ExprInput<T>),
      right: toExprNode(upper as ExprInput<T>),
    }
  ) as Expr<PredicateResult<
    ExprInputValue<TValue> | ExprInputValue<TLower> | ExprInputValue<TUpper>
  >>;
}

export function isDistinctFrom<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
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
    current = {
      kind: "binary",
      op,
      left: current,
      right: toExprNode(value as BooleanInput),
    };
  }
  return exprOf<SqlBoolean | null>(current as unknown as ExprNode<SqlBoolean | null>);
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
