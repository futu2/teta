import type { OrderItem } from "../../../core/types";
import type { SqlDate, SqlNumber, SqlTimestamp } from "../../types";
import { ExprRef, binaryExpr, toExprNode, type ExprInput } from "../core";

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp;

export function eq<T>(left: ExprInput<T>, right: ExprInput<T>): ExprRef<boolean> {
  return binaryExpr("=", toExprNode(left), toExprNode(right));
}

export function ne<T>(left: ExprInput<T>, right: ExprInput<T>): ExprRef<boolean> {
  return binaryExpr("!=", toExprNode(left), toExprNode(right));
}

export function gt<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr(">", toExprNode(left), toExprNode(right));
}

export function gte<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr(">=", toExprNode(left), toExprNode(right));
}

export function lt<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr("<", toExprNode(left), toExprNode(right));
}

export function lte<T extends ComparableInput>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<boolean> {
  return binaryExpr("<=", toExprNode(left), toExprNode(right));
}

export function like(left: ExprInput<string>, right: ExprInput<string>): ExprRef<boolean> {
  return binaryExpr("LIKE", toExprNode(left), toExprNode(right));
}

export function isIn<T>(
  value: ExprInput<T>,
  values: readonly ExprInput<T>[]
): ExprRef<boolean> {
  if (values.length === 0) {
    throw new Error("in requires at least one value");
  }
  return binaryExpr("IN", toExprNode(value), {
    kind: "list",
    items: values.map((item) => toExprNode(item)),
  });
}

export function and(
  left: ExprInput<boolean>,
  right: ExprInput<boolean>
): ExprRef<boolean> {
  return binaryExpr("AND", toExprNode(left), toExprNode(right));
}

export function or(
  left: ExprInput<boolean>,
  right: ExprInput<boolean>
): ExprRef<boolean> {
  return binaryExpr("OR", toExprNode(left), toExprNode(right));
}

export function not(value: ExprInput<boolean>): ExprRef<boolean> {
  return new ExprRef<boolean>({ kind: "unary", op: "NOT", expr: toExprNode(value) });
}

export function isNull(value: ExprInput<unknown>): ExprRef<boolean> {
  return binaryExpr("IS", toExprNode(value), toExprNode(null));
}

export function isNotNull(value: ExprInput<unknown>): ExprRef<boolean> {
  return binaryExpr("IS NOT", toExprNode(value), toExprNode(null));
}

export function asc(value: ExprInput<unknown>): OrderItem {
  return { expr: toExprNode(value), direction: "ASC" };
}

export function desc(value: ExprInput<unknown>): OrderItem {
  return { expr: toExprNode(value), direction: "DESC" };
}
