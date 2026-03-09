import type { QueryDialect } from "../types";
import { isInternalScopeName, type ExprNode, type ScopeId, type SelectItem } from "../../core/types";
import { shouldAlias } from "../../core/expr";
import { selectItemOutputName } from "../../query/utils";
import type { ScopeBindings } from "./types";
import { renderIdentifier } from "./identifiers";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render";

export type ScopeExprLookup = Partial<Record<ScopeId, Record<string, ExprNode<unknown>>>>;

export function bindFusedExpr(
  expr: ExprNode<unknown>,
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): ExprNode<unknown> {
  return bindExprScopes(expandScopeExprs(expr, scopeExprs), bindings, dialect);
}

export function selectExpandedColumns(
  scopeId: ScopeId,
  columnNames: readonly string[],
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): import("./types").SelectColumnAst[] {
  return columnNames.map((name) => {
    const expr = bindFusedExpr({ kind: "column", table: scopeId, name }, scopeExprs, bindings, dialect);
    return {
      expr: exprToAst(expr),
      as: shouldAlias(expr, name)
        ? renderIdentifier({ name, quoted: false }, dialect, getSqlRenderContext())
        : null,
    };
  });
}

export function selectItemsToScopeMap(items: SelectItem[]): Record<string, ExprNode<unknown>> {
  const mapping: Record<string, ExprNode<unknown>> = {};
  for (const item of items) {
    const name = selectItemOutputName(item);
    if (!name) {
      throw new Error("Cannot fuse a stage with unnamed select items");
    }
    mapping[name] = item.expr;
  }
  return mapping;
}

function expandScopeExprs(
  expr: ExprNode<unknown>,
  scopeExprs: ScopeExprLookup
): ExprNode<unknown> {
  switch (expr.kind) {
    case "column": {
      if (!expr.table || !isInternalScopeName(expr.table)) return expr;
      const mapping = scopeExprs[expr.table];
      if (!mapping) return expr;
      const expanded = mapping[expr.name];
      if (!expanded) {
        throw new Error(`Missing fused scope mapping for ${expr.table}.${expr.name}`);
      }
      return expandScopeExprs(expanded, scopeExprs);
    }
    case "binary":
      return {
        ...expr,
        left: expandScopeExprs(expr.left, scopeExprs),
        right: expandScopeExprs(expr.right, scopeExprs),
      };
    case "unary":
      return { ...expr, expr: expandScopeExprs(expr.expr, scopeExprs) };
    case "agg":
      return { ...expr, arg: expandScopeExprs(expr.arg, scopeExprs) };
    case "group":
      return { ...expr, expr: expandScopeExprs(expr.expr, scopeExprs) };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => expandScopeExprs(arg, scopeExprs)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => expandScopeExprs(item, scopeExprs)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => expandScopeExprs(item, scopeExprs)),
      };
    case "extract":
      return {
        ...expr,
        source: expandScopeExprs(expr.source, scopeExprs),
      };
    case "cast":
      return {
        ...expr,
        expr: expandScopeExprs(expr.expr, scopeExprs),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => expandScopeExprs(arg, scopeExprs)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => expandScopeExprs(arg, scopeExprs))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: expandScopeExprs(item.expr, scopeExprs),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: expandScopeExprs(item.when, scopeExprs),
          then: expandScopeExprs(item.then, scopeExprs),
        })),
        elseExpr: expr.elseExpr
          ? expandScopeExprs(expr.elseExpr, scopeExprs)
          : null,
      };
    default:
      return expr;
  }
}
