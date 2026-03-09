import type { ExprNode } from "../../core/types";

export function func(name: string, args: ExprNode<any>[]): ExprNode<any> {
  return {
    kind: "func",
    name,
    args,
  };
}

export function binaryExpr(
  op: "+" | "-" | "*" | "/" | ">" | "IS NOT" | "||",
  left: ExprNode<any>,
  right: ExprNode<any>
): ExprNode<any> {
  return {
    kind: "binary",
    op,
    left,
    right,
  };
}

export function arrayExpr(...items: ExprNode<any>[]): ExprNode<any> {
  return {
    kind: "array",
    items,
  };
}

export function castExpr(expr: ExprNode<any>, target: string): ExprNode<any> {
  return {
    kind: "cast",
    expr,
    target,
  };
}

export function literal(value: string | number | boolean | null): ExprNode<any> {
  return {
    kind: "literal",
    value,
  };
}

export function literalString(expr: ExprNode<any>): string | null {
  if (expr.kind !== "literal") return null;
  return typeof expr.value === "string" ? expr.value : null;
}

export function extractFieldExpr(field: string, source: ExprNode<any>): ExprNode<any> {
  return {
    kind: "extract",
    field,
    source,
  };
}

export function extractFieldAsInt(field: string, source: ExprNode<any>): ExprNode<any> {
  return castExpr(extractFieldExpr(field, source), "INTEGER");
}
