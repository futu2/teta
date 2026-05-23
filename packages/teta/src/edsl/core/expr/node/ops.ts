import { OUTER_TABLE_ALIAS, isInternalScopeName, type ExprNode } from "../../types.ts";
import { userError } from "../../../errors.ts";

export function containsGroup(expr: ExprNode<unknown>, inAgg = false): boolean {
  switch (expr.kind) {
    case "group":
      return !inAgg;
    case "binary":
      return (
        containsGroup(expr.left, inAgg) || containsGroup(expr.right, inAgg)
      );
    case "unary":
      return containsGroup(expr.expr, inAgg);
    case "agg":
      return containsGroup(expr.arg, true);
    case "func":
      return expr.args.some((arg) => containsGroup(arg, inAgg));
    case "list":
      return expr.items.some((item) => containsGroup(item, inAgg));
    case "array":
      return expr.items.some((item) => containsGroup(item, inAgg));
    case "extract":
      return containsGroup(expr.source, inAgg);
    case "cast":
      return containsGroup(expr.expr, inAgg);
    case "window":
      return (
        expr.args.some((arg) => containsGroup(arg, inAgg)) ||
        (expr.partitionBy
          ? expr.partitionBy.some((arg) => containsGroup(arg, inAgg))
          : false) ||
        (expr.orderBy
          ? expr.orderBy.some((item) => containsGroup(item.expr, inAgg))
          : false)
      );
    case "case":
      return (
        expr.whens.some(
          (item) =>
            containsGroup(item.when, inAgg) || containsGroup(item.then, inAgg)
        ) || (expr.elseExpr ? containsGroup(expr.elseExpr, inAgg) : false)
      );
    default:
      return false;
  }
}

export function unwrapGroupExpr(
  expr: ExprNode<unknown>,
  groupBy: ExprNode<unknown>[],
  inAgg: boolean
): ExprNode<unknown> {
  switch (expr.kind) {
    case "group":
      if (inAgg) {
        userError("GROUP_INSIDE_AGGREGATE_FUNCTION", "group() cannot be used inside fold functions");
      }
      groupBy.push(expr.expr);
      return unwrapGroupExpr(expr.expr, groupBy, false);
    case "binary":
      return {
        ...expr,
        left: unwrapGroupExpr(expr.left, groupBy, inAgg),
        right: unwrapGroupExpr(expr.right, groupBy, inAgg),
      };
    case "unary":
      return {
        ...expr,
        expr: unwrapGroupExpr(expr.expr, groupBy, inAgg),
      };
    case "agg":
      return {
        ...expr,
        arg: unwrapGroupExpr(expr.arg, groupBy, true),
      };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => unwrapGroupExpr(arg, groupBy, inAgg)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => unwrapGroupExpr(item, groupBy, inAgg)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => unwrapGroupExpr(item, groupBy, inAgg)),
      };
    case "extract":
      return {
        ...expr,
        source: unwrapGroupExpr(expr.source, groupBy, inAgg),
      };
    case "cast":
      return {
        ...expr,
        expr: unwrapGroupExpr(expr.expr, groupBy, inAgg),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => unwrapGroupExpr(arg, groupBy, inAgg)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => unwrapGroupExpr(arg, groupBy, inAgg))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: unwrapGroupExpr(item.expr, groupBy, inAgg),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: unwrapGroupExpr(item.when, groupBy, inAgg) as ExprNode<boolean | null>,
          then: unwrapGroupExpr(item.then, groupBy, inAgg),
        })),
        elseExpr: expr.elseExpr
          ? unwrapGroupExpr(expr.elseExpr, groupBy, inAgg)
          : null,
      };
    default:
      return expr;
  }
}

export function dedupeExprs(exprs: ExprNode<unknown>[]): ExprNode<unknown>[] {
  if (exprs.length <= 1) return exprs;
  const seen = new Set<string>();
  const result: ExprNode<unknown>[] = [];
  for (const expr of exprs) {
    const key = JSON.stringify(expr);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(expr);
  }
  return result;
}

export function shouldAlias(expr: ExprNode<unknown>, key: string): boolean {
  if (expr.kind !== "column") return true;
  return expr.name !== key || (expr.table !== null && !isInternalScopeName(expr.table) && expr.table !== OUTER_TABLE_ALIAS);
}
