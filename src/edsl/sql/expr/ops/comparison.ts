import type { OrderItem } from "../../../core/types.ts";
import type { SqlDate, SqlNumber, SqlTimestamp } from "../../types.ts";
import { ExprRef, binaryExpr, toExprNode, type ExprInput } from "../core.ts";
import { userError } from "../../../errors.ts";

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp | null;

export function eq<T>(left: ExprInput<T>, right: ExprInput<T>): ExprRef<boolean> {
  return binaryExpr("=", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function ne<T>(left: ExprInput<T>, right: ExprInput<T>): ExprRef<boolean> {
  return binaryExpr("!=", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function gt<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr(">", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function gte<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr(">=", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function lt<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr("<", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function lte<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr("<=", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function like(left: ExprInput<string | null>, right: ExprInput<string>): ExprRef<boolean> {
  return binaryExpr("LIKE", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function isIn<T>(
  value: ExprInput<T>,
  values: readonly ExprInput<T>[]
): ExprRef<boolean> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "in requires at least one value");
  }
  return binaryExpr("IN", toExprNode(value), {
    kind: "list",
    items: values.map((item) => toExprNode(item)),
  }) as ExprRef<boolean>;
}

export function and(
  left: ExprInput<boolean | null>,
  right: ExprInput<boolean | null>
): ExprRef<boolean> {
  return binaryExpr("AND", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function or(
  left: ExprInput<boolean | null>,
  right: ExprInput<boolean | null>
): ExprRef<boolean> {
  return binaryExpr("OR", toExprNode(left), toExprNode(right)) as ExprRef<boolean>;
}

export function not(value: ExprInput<boolean | null>): ExprRef<boolean> {
  return new ExprRef<boolean>({ kind: "unary", op: "NOT", expr: toExprNode(value) });
}

export function isNull(value: ExprInput<unknown>): ExprRef<boolean> {
  return binaryExpr("IS", toExprNode(value), toExprNode(null)) as ExprRef<boolean>;
}

export function isNotNull(value: ExprInput<unknown>): ExprRef<boolean> {
  return binaryExpr("IS NOT", toExprNode(value), toExprNode(null)) as ExprRef<boolean>;
}

export function asc(value: ExprInput<unknown>): OrderItem {
  return { expr: toExprNode(value), direction: "ASC" };
}

export function desc(value: ExprInput<unknown>): OrderItem {
  return { expr: toExprNode(value), direction: "DESC" };
}
