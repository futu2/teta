import type {
  ArrayNode,
  CaseNode,
  ExprNode,
  FuncNode,
  ListNode,
  OrderItem,
  WindowNode,
} from "../../core/types.ts";
import type {
  ArrayAst,
  AstIdentifierExpr,
  AstKeywordExpr,
  CaseAst,
  ExprListAst,
  FunctionAst,
  OrderByAst,
  ParserExprAst,
  SqlRenderContext,
  WindowOverAst,
  WindowPartitionItemAst,
} from "./types.ts";

const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

type RenderExpr = (
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null
) => ParserExprAst;

export function funcExprToAst(
  expr: FuncNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): FunctionAst {
  const normalized = expr.name.trim();
  const upperName = normalized.toUpperCase();
  if (upperName === "POSITION" && expr.args.length === 2) {
    const positionName: AstKeywordExpr = { type: "origin", value: "position" };
    const inKeyword: AstKeywordExpr = { type: "origin", value: "in" };
    const args: ExprListAst = {
      type: "expr_list",
      value: [
        renderExpr(expr.args[0]!, renderContext),
        inKeyword,
        renderExpr(expr.args[1]!, renderContext),
      ],
    };
    return {
      type: "function",
      name: {
        name: [positionName],
      },
      separator: " ",
      args,
      over: null,
    };
  }
  if (expr.args.length === 0 && keywordFunctions.has(upperName)) {
    const keywordName: AstKeywordExpr = { type: "origin", value: upperName };
    return {
      type: "function",
      name: {
        name: [keywordName],
      },
      over: null,
    };
  }
  const functionName: AstIdentifierExpr = {
    type: "default",
    value: normalized.toLowerCase(),
  };
  const args: ExprListAst = {
    type: "expr_list",
    value: expr.args.map((item) => renderExpr(item, renderContext)),
  };
  return {
    type: "function",
    name: {
      name: [functionName],
    },
    args,
    over: null,
  };
}

export function listExprToAst(
  expr: ListNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): ExprListAst {
  return {
    type: "expr_list",
    value: expr.items.map((item) => renderExpr(item, renderContext)),
  };
}

export function arrayExprToAst(
  expr: ArrayNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): ArrayAst {
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
): FunctionAst {
  const functionName: AstIdentifierExpr = {
    type: "default",
    value: expr.name.toLowerCase(),
  };
  const args: ExprListAst = {
    type: "expr_list",
    value: expr.args.map((item) => renderExpr(item, renderContext)),
  };
  return {
    type: "function",
    name: {
      name: [functionName],
    },
    args,
    over: buildWindowOver(expr.partitionBy, expr.orderBy, renderContext, renderExpr),
  };
}

export function caseExprToAst(
  expr: CaseNode,
  renderContext: SqlRenderContext | null,
  renderExpr: RenderExpr
): CaseAst {
  const whens = expr.whens.map<Extract<CaseAst["args"][number], { type: "when" }>>((item) => ({
    type: "when",
    cond: renderExpr(item.when, renderContext),
    result: renderExpr(item.then, renderContext),
  }));
  const args: CaseAst["args"] = expr.elseExpr
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
): WindowOverAst {
  return {
    type: "window",
    as_window_specification: {
      window_specification: {
        name: null,
        partitionby: partitionBy
          ? partitionBy.map<WindowPartitionItemAst>((expr) => ({
              expr: renderExpr(expr, renderContext),
              as: null,
            }))
          : null,
        orderby: orderBy
          ? orderBy.map<OrderByAst>((item) => ({
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
