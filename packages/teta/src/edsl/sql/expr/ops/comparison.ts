import type { SqlDate, SqlNumber, SqlTimestamp } from "../../types.ts";
import {
  ExprRef,
  binaryExpr,
  toExprNode,
  type DeferredOrderItem,
  type DeferredExprDepsForArgs,
  type ExprInput,
} from "../core.ts";
import { userError } from "../../../errors.ts";

type ComparableInput = SqlNumber | number | bigint | SqlDate | SqlTimestamp | null;

export function eq<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function ne<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "!=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function gt<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    ">",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function gte<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    ">=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function lt<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "<",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function lte<T extends ComparableInput, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "<=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function like<TLeft extends ExprInput<string | null>, TRight extends ExprInput<string>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "LIKE",
    toExprNode(left as ExprInput<string | null>),
    toExprNode(right as ExprInput<string>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function isIn<T, TValue extends ExprInput<T>, const TValues extends readonly ExprInput<T>[]>(
  value: TValue,
  values: TValues
): ExprRef<boolean, DeferredExprDepsForArgs<[TValue, ...TValues]>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "in requires at least one value");
  }
  return binaryExpr<DeferredExprDepsForArgs<[TValue, ...TValues]>>("IN", toExprNode(value as ExprInput<T>), {
    kind: "list",
    items: values.map((item) => toExprNode(item as ExprInput<T>)),
  }) as ExprRef<boolean, DeferredExprDepsForArgs<[TValue, ...TValues]>>;
}

export function and<TLeft extends ExprInput<boolean | null>, TRight extends ExprInput<boolean | null>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "AND",
    toExprNode(left as ExprInput<boolean | null>),
    toExprNode(right as ExprInput<boolean | null>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function or<TLeft extends ExprInput<boolean | null>, TRight extends ExprInput<boolean | null>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "OR",
    toExprNode(left as ExprInput<boolean | null>),
    toExprNode(right as ExprInput<boolean | null>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}

export function not<TValue extends ExprInput<boolean | null>>(
  value: TValue
): ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>> {
  return new ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>>({
    kind: "unary",
    op: "NOT",
    expr: toExprNode(value as ExprInput<boolean | null>),
  });
}

export function isNull<TValue extends ExprInput<unknown>>(
  value: TValue
): ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TValue]>>(
    "IS",
    toExprNode(value as ExprInput<unknown>),
    toExprNode(null)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>>;
}

export function isNotNull<TValue extends ExprInput<unknown>>(
  value: TValue
): ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TValue]>>(
    "IS NOT",
    toExprNode(value as ExprInput<unknown>),
    toExprNode(null)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TValue]>>;
}

export function asc<TValue extends ExprInput<unknown>>(
  value: TValue
): DeferredOrderItem<DeferredExprDepsForArgs<[TValue]>> {
  return { expr: toExprNode(value as ExprInput<unknown>), direction: "ASC" };
}

export function desc<TValue extends ExprInput<unknown>>(
  value: TValue
): DeferredOrderItem<DeferredExprDepsForArgs<[TValue]>> {
  return { expr: toExprNode(value as ExprInput<unknown>), direction: "DESC" };
}
