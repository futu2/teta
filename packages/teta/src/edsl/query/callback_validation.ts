import type { OrderItem } from "../core/types.ts";
import { isExpr, isExprNode, type Expr } from "../expr.ts";
import { userError } from "../errors.ts";

export function assertExprCallbackResult(
  helper: string,
  value: unknown,
  expected = "an expression"
): asserts value is Expr<unknown> {
  if (!isExpr(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return ${expected}`);
  }
}

export function assertOrderItemCallbackResult(
  helper: string,
  value: unknown
): asserts value is OrderItem {
  if (!isOrderItem(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return order item(s)`);
  }
}

function isOrderItem(value: unknown): value is OrderItem {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || !isExprNode((value as { expr?: unknown }).expr)
  ) {
    return false;
  }

  const direction = (value as { direction?: unknown }).direction;
  return direction === "ASC" || direction === "DESC";
}
