import type { ExprNode } from "../../core/types.ts";
import type { DialectLanguageConfig } from "../types.ts";
import { userError } from "../../errors.ts";

type ResolvedLanguage = Required<DialectLanguageConfig>;

import {
  applyFallback,
  resolveFunctionName,
  rewriteFallback,
} from "./fallback.ts";
import { literal } from "./fallback_ast.ts";

export function rewriteDialectExpr(
  expr: ExprNode<any>,
  language: ResolvedLanguage
): ExprNode<any> {
  switch (expr.kind) {
    case "binary":
      return {
        ...expr,
        left: rewriteDialectExpr(expr.left, language),
        right: rewriteDialectExpr(expr.right, language),
      };
    case "unary":
      return { ...expr, expr: rewriteDialectExpr(expr.expr, language) };
    case "agg":
      return {
        ...expr,
        name: resolveFunctionName(expr.name, language),
        arg: rewriteDialectExpr(expr.arg, language),
      };
    case "group":
      return { ...expr, expr: rewriteDialectExpr(expr.expr, language) };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteDialectExpr(item, language)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteDialectExpr(item, language)),
      };
    case "extract": {
      const source = rewriteDialectExpr(expr.source, language);
      const fallback = language.fallbacks.EXTRACT;
      if (fallback) {
        return rewriteFallback("EXTRACT", [literal(expr.field), source], fallback);
      }
      return {
        ...expr,
        source,
      };
    }
    case "cast": {
      const rewrittenExpr = rewriteDialectExpr(expr.expr, language);
      if (expr.target.trim().toUpperCase() === "DATE") {
        const fallback = language.fallbacks.CAST_DATE;
        if (fallback) {
          return rewriteFallback("CAST_DATE", [rewrittenExpr], fallback);
        }
      }
      return {
        ...expr,
        expr: rewrittenExpr,
      };
    }
    case "window":
      return {
        ...expr,
        name: resolveFunctionName(expr.name, language),
        args: expr.args.map((arg) => rewriteDialectExpr(arg, language)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => rewriteDialectExpr(arg, language))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: rewriteDialectExpr(item.expr, language),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: rewriteDialectExpr(item.when, language) as ExprNode<boolean>,
          then: rewriteDialectExpr(item.then, language),
        })),
        elseExpr: expr.elseExpr ? rewriteDialectExpr(expr.elseExpr, language) : null,
      };
    case "func": {
      const mappedName = resolveFunctionName(expr.name, language);
      const rewrittenArgs = expr.args.map((arg) => rewriteDialectExpr(arg, language));
      return applyFallback(mappedName, rewrittenArgs, language);
    }
    default:
      return expr;
  }
}

export function validateDialectExpr(
  expr: ExprNode<any>,
  language: ResolvedLanguage
): void {
  switch (expr.kind) {
    case "binary":
      validateDialectExpr(expr.left, language);
      validateDialectExpr(expr.right, language);
      return;
    case "unary":
      validateDialectExpr(expr.expr, language);
      return;
    case "agg":
      validateDialectExpr(expr.arg, language);
      return;
    case "group":
      validateDialectExpr(expr.expr, language);
      return;
    case "extract":
      validateDialectExpr(expr.source, language);
      return;
    case "cast":
      validateDialectExpr(expr.expr, language);
      return;
    case "list":
      expr.items.forEach((item) => validateDialectExpr(item, language));
      return;
    case "array":
      expr.items.forEach((item) => validateDialectExpr(item, language));
      return;
    case "window":
      expr.args.forEach((item) => validateDialectExpr(item, language));
      expr.partitionBy?.forEach((item) => validateDialectExpr(item, language));
      expr.orderBy?.forEach((item) => validateDialectExpr(item.expr, language));
      return;
    case "case":
      expr.whens.forEach((item) => {
        validateDialectExpr(item.when, language);
        validateDialectExpr(item.then, language);
      });
      if (expr.elseExpr) validateDialectExpr(expr.elseExpr, language);
      return;
    case "func": {
      const normalized = expr.name.toUpperCase();
      if (language.unsupported.includes(normalized)) {
        userError("UNSUPPORTED_DIALECT_FUNCTION", `Function ${expr.name} is not supported by this dialect`);
      }
      expr.args.forEach((item) => validateDialectExpr(item, language));
      return;
    }
    default:
      return;
  }
}
