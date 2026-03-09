import type {
  ArrayNode,
  CaseNode,
  ExprNode,
  FuncNode,
  ListNode,
  OrderItem,
  WindowNode,
} from "../../core/types";
import type { SqlRenderContext } from "./types";

const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

type RenderExpr = (
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null
) => unknown;

export function funcExprToAst(
  expr: FuncNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  const normalized = expr.name.trim();
  const upperName = normalized.toUpperCase();
  if (upperName === "POSITION" && expr.args.length === 2) {
    return {
      type: "function",
      name: {
        name: [{ type: "origin", value: "position" }],
      },
      separator: " ",
      args: {
        type: "expr_list",
        value: [
          renderExpr(expr.args[0]!, renderContext),
          { type: "origin", value: "in" },
          renderExpr(expr.args[1]!, renderContext),
        ],
      },
      over: null,
    };
  }
  if (expr.args.length === 0 && keywordFunctions.has(upperName)) {
    return {
      type: "function",
      name: {
        name: [{ type: "origin", value: upperName }],
      },
      over: null,
    };
  }
  return {
    type: "function",
    name: {
      name: [{ type: "default", value: normalized.toLowerCase() }],
    },
    args: {
      type: "expr_list",
      value: expr.args.map((item) => renderExpr(item, renderContext)),
    },
    over: null,
  };
}

export function listExprToAst(
  expr: ListNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  return {
    type: "expr_list",
    value: expr.items.map((item) => renderExpr(item, renderContext)),
  };
}

export function arrayExprToAst(
  expr: ArrayNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  return {
    type: "array",
    keyword: "array",
    expr_list: {
      type: "expr_list",
      value: expr.items.map((item) => renderExpr(item, renderContext)),
    },
    brackets: true,
  };
}

export function windowExprToAst(
  expr: WindowNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  return {
    type: "function",
    name: {
      name: [{ type: "default", value: expr.name.toLowerCase() }],
    },
    args: {
      type: "expr_list",
      value: expr.args.map((item) => renderExpr(item, renderContext)),
    },
    over: buildWindowOver(expr.partitionBy, expr.orderBy, renderContext, renderExpr),
  };
}

export function caseExprToAst(
  expr: CaseNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  const whens = expr.whens.map((item) => ({
    type: "when",
    cond: renderExpr(item.when, renderContext),
    result: renderExpr(item.then, renderContext),
  }));
  const args = expr.elseExpr
    ? [
        ...whens,
        {
          type: "else",
          result: renderExpr(expr.elseExpr, renderContext),
        },
      ]
    : whens;
  return {
    type: "case",
    expr: null,
    args,
  };
}

function buildWindowOver(
  partitionBy: ExprNode<unknown>[] | null,
  orderBy: OrderItem[] | null,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): unknown {
  return {
    type: "window",
    as_window_specification: {
      window_specification: {
        name: null,
        partitionby: partitionBy
          ? partitionBy.map((expr) => ({ expr: renderExpr(expr, renderContext), as: null }))
          : null,
        orderby: orderBy
          ? orderBy.map((item) => ({
              expr: renderExpr(item.expr, renderContext),
              type: item.direction,
            }))
          : null,
        window_frame_clause: null,
      },
      parentheses: true,
    },
  };
}
