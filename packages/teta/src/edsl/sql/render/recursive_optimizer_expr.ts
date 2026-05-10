import type { ExprNode } from "../../core/types.ts";
import { internalError } from "../../errors.ts";

export type CollectExprColumnOptions = {
  excludeTable?: string | null;
};

export function collectExprColumns(
  expr: ExprNode<unknown>,
  out: Set<string>,
  options?: CollectExprColumnOptions
): void {
  switch (expr.kind) {
    case "column":
      if (options?.excludeTable !== undefined && expr.table === options.excludeTable) {
        return;
      }
      out.add(expr.name);
      return;
    case "binary":
      collectExprColumns(expr.left, out, options);
      collectExprColumns(expr.right, out, options);
      return;
    case "unary":
      collectExprColumns(expr.expr, out, options);
      return;
    case "agg":
      collectExprColumns(expr.arg, out, options);
      return;
    case "group":
      collectExprColumns(expr.expr, out, options);
      return;
    case "func":
      expr.args.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "list":
      expr.items.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "array":
      expr.items.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "extract":
      collectExprColumns(expr.source, out, options);
      return;
    case "cast":
      collectExprColumns(expr.expr, out, options);
      return;
    case "window":
      expr.args.forEach((arg) => collectExprColumns(arg, out, options));
      expr.partitionBy?.forEach((arg) => collectExprColumns(arg, out, options));
      expr.orderBy?.forEach((item) => collectExprColumns(item.expr, out, options));
      return;
    case "case":
      expr.whens.forEach((item) => {
        collectExprColumns(item.when, out, options);
        collectExprColumns(item.then, out, options);
      });
      if (expr.elseExpr) collectExprColumns(expr.elseExpr, out, options);
      return;
    case "literal":
    case "param":
      return;
    case "deferred_column":
      internalError(
        "INTERNAL_UNRESOLVED_DEFERRED_COLUMN",
        `Deferred column was not resolved before recursive optimization: ${expr.scope}.${expr.name}`
      );
    default:
      assertNever(expr);
  }
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
