import type { QueryDialect } from "../types.ts";
import { OUTER_TABLE_ALIAS, isInternalScopeName, type ExprNode, type ScopeId, type ProjectionItem } from "../ir/types.ts";
import { projectionItemOutputName } from "../ir/utils.ts";
import type { ScopeBindings } from "./types.ts";
import { renderIdentifier } from "./identifiers.ts";
import { internalError } from "../errors.ts";
import { createDictionary } from "../dictionary.ts";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render.ts";

export type ScopeExprLookup = Partial<Record<ScopeId, Record<string, ExprNode<unknown>>>>;

export function bindFusedExpr(
  expr: ExprNode<unknown>,
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): ExprNode<unknown> {
  return bindExprScopes(expandScopeExprs(expr, scopeExprs), bindings, dialect);
}

export function expandProjectedColumns(
  scopeId: ScopeId,
  columnNames: readonly string[],
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): import("./types.ts").SelectColumnAst[] {
  return columnNames.map((name) => {
    const expr = bindFusedExpr({ kind: "column", table: scopeId, name }, scopeExprs, bindings, dialect);
    return {
      expr: exprToAst(expr),
      as: shouldAliasProjectedColumn(expr, name)
        ? renderIdentifier({ name, quoted: false }, dialect, getSqlRenderContext())
        : null,
    };
  });
}

export function projectionItemsToScopeMap(
  items: readonly ProjectionItem[]
): Record<string, ExprNode<unknown>> {
  const mapping = createDictionary<ExprNode<unknown>>();
  for (const item of items) {
    const name = projectionItemOutputName(item);
    if (!name) {
      internalError("INTERNAL_UNNAMED_PROJECTION_ITEM", "Cannot fuse a stage with unnamed projection items");
    }
    mapping[name] = item.expr;
  }
  return mapping;
}

function shouldAliasProjectedColumn(expr: ExprNode<unknown>, key: string): boolean {
  return (
    expr.kind !== "column" ||
    expr.name !== key ||
    (expr.table !== null && !isInternalScopeName(expr.table) && expr.table !== OUTER_TABLE_ALIAS)
  );
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
        internalError("INTERNAL_MISSING_FUSED_SCOPE_MAPPING", `Missing fused scope mapping for ${expr.table}.${expr.name}`);
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
    case "builtin":
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
          when: expandScopeExprs(item.when, scopeExprs) as ExprNode<boolean | null>,
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
