import {
  OUTER_TABLE_ALIAS,
  isInternalScopeName,
  type ExprNode,
} from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import { applyDialectLanguage } from "../language.ts";
import { internalError } from "../errors.ts";
import { getDefaultDialect } from "../dialect.ts";
import type { ScopeBindings } from "./types.ts";

export function bindExprScopes(
  expr: ExprNode<unknown>,
  scopeBindings: ScopeBindings,
  dialect: QueryDialect = getDefaultDialect()
): ExprNode<unknown> {
  return applyDialectLanguage(resolveExprScopes(expr, scopeBindings), dialect);
}

function resolveExprScopes(
  expr: ExprNode<unknown>,
  scopeBindings: ScopeBindings
): ExprNode<unknown> {
  switch (expr.kind) {
    case "column":
      return resolveColumnScope(expr, scopeBindings);
    case "binary":
      return {
        ...expr,
        left: resolveExprScopes(expr.left, scopeBindings),
        right: resolveExprScopes(expr.right, scopeBindings),
      };
    case "unary":
      return {
        ...expr,
        expr: resolveExprScopes(expr.expr, scopeBindings),
      };
    case "agg":
      return {
        ...expr,
        arg: resolveExprScopes(expr.arg, scopeBindings),
      };
    case "group":
      return {
        ...expr,
        expr: resolveExprScopes(expr.expr, scopeBindings),
      };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => resolveExprScopes(arg, scopeBindings)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => resolveExprScopes(item, scopeBindings)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => resolveExprScopes(item, scopeBindings)),
      };
    case "extract":
      return {
        ...expr,
        source: resolveExprScopes(expr.source, scopeBindings),
      };
    case "cast":
      return {
        ...expr,
        expr: resolveExprScopes(expr.expr, scopeBindings),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => resolveExprScopes(arg, scopeBindings)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => resolveExprScopes(arg, scopeBindings))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: resolveExprScopes(item.expr, scopeBindings),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: resolveExprScopes(item.when, scopeBindings) as ExprNode<boolean | null>,
          then: resolveExprScopes(item.then, scopeBindings),
        })),
        elseExpr: expr.elseExpr
          ? resolveExprScopes(expr.elseExpr, scopeBindings)
          : null,
      };
    default:
      return expr;
  }
}

function resolveColumnScope(
  expr: Extract<ExprNode<unknown>, { kind: "column" }>,
  scopeBindings: ScopeBindings
): ExprNode<unknown> {
  if (expr.table === null) return expr;
  if (expr.table === OUTER_TABLE_ALIAS) return expr;
  if (!isInternalScopeName(expr.table)) return expr;
  const boundTable = scopeBindings[expr.table];
  if (boundTable === undefined) {
    internalError("INTERNAL_MISSING_SQL_SCOPE_BINDING", `Missing SQL scope binding for ${expr.table}.${expr.name}`);
  }
  return {
    ...expr,
    table: boundTable ?? null,
  };
}
