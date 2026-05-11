import type { ExprNode } from "../ir/types.ts";

export function containsWindow(expr: ExprNode<unknown>): boolean {
  switch (expr.kind) {
    case "window":
      return true;
    case "binary":
      return containsWindow(expr.left) || containsWindow(expr.right);
    case "unary":
      return containsWindow(expr.expr);
    case "agg":
      return containsWindow(expr.arg);
    case "group":
      return containsWindow(expr.expr);
    case "func":
      return expr.args.some(containsWindow);
    case "list":
      return expr.items.some(containsWindow);
    case "array":
      return expr.items.some(containsWindow);
    case "extract":
      return containsWindow(expr.source);
    case "cast":
      return containsWindow(expr.expr);
    case "case":
      return (
        expr.whens.some((item) => containsWindow(item.when) || containsWindow(item.then)) ||
        (expr.elseExpr ? containsWindow(expr.elseExpr) : false)
      );
    default:
      return false;
  }
}

export function containsAggregate(expr: ExprNode<unknown>): boolean {
  switch (expr.kind) {
    case "agg":
      return true;
    case "binary":
      return containsAggregate(expr.left) || containsAggregate(expr.right);
    case "unary":
      return containsAggregate(expr.expr);
    case "group":
      return containsAggregate(expr.expr);
    case "func":
      return expr.args.some(containsAggregate);
    case "list":
      return expr.items.some(containsAggregate);
    case "array":
      return expr.items.some(containsAggregate);
    case "extract":
      return containsAggregate(expr.source);
    case "cast":
      return containsAggregate(expr.expr);
    case "window":
      return (
        expr.args.some(containsAggregate) ||
        (expr.partitionBy ? expr.partitionBy.some(containsAggregate) : false) ||
        (expr.orderBy ? expr.orderBy.some((item) => containsAggregate(item.expr)) : false)
      );
    case "case":
      return (
        expr.whens.some((item) => containsAggregate(item.when) || containsAggregate(item.then)) ||
        (expr.elseExpr ? containsAggregate(expr.elseExpr) : false)
      );
    default:
      return false;
  }
}
