import type {
  ExprNode,
} from "../../core/types";
import type { SqlRenderContext } from "./types";
import { literalToAst } from "./expr_ast_literal";
import {
  arrayExprToAst,
  caseExprToAst,
  funcExprToAst,
  listExprToAst,
  windowExprToAst,
} from "./expr_ast_compound";

export function exprNodeToAst(
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null
): unknown {
  switch (expr.kind) {
    case "column": {
      const table =
        expr.table === null
          ? null
          : renderContext?.mode === "ast"
            ? (renderContext.identifierBindings[expr.table] ?? expr.table)
            : expr.table;
      const column =
        expr.table === null
          ? expr.name
          : (renderContext?.columnIdentifierBindings[`${expr.table}.${expr.name}`] ?? expr.name);
      return {
        type: "column_ref",
        table,
        column,
        collate: null,
      };
    }
    case "literal":
      return literalToAst(expr.value, renderContext);
    case "binary":
      return {
        type: "binary_expr",
        operator: expr.op,
        left: exprNodeToAst(expr.left, renderContext),
        right: exprNodeToAst(expr.right, renderContext),
      };
    case "unary":
      return {
        type: "unary_expr",
        operator: expr.op,
        expr: exprNodeToAst(expr.expr, renderContext),
      };
    case "agg":
      return {
        type: "aggr_func",
        name: expr.name,
        args: {
          distinct: expr.distinct ? "DISTINCT" : null,
          expr: exprNodeToAst(expr.arg, renderContext),
          orderby: null,
          separator: null,
        },
        over: null,
      };
    case "group":
      return exprNodeToAst(expr.expr, renderContext);
    case "extract":
      return {
        type: "extract",
        args: {
          field: expr.field.toLowerCase(),
          cast_type: null,
          source: exprNodeToAst(expr.source, renderContext),
        },
      };
    case "cast":
      return {
        type: "cast",
        keyword: "cast",
        expr: exprNodeToAst(expr.expr, renderContext),
        symbol: "as",
        target: [{ dataType: expr.target.toUpperCase() }],
      };
    case "func":
      return funcExprToAst(expr, renderContext, exprNodeToAst);
    case "list":
      return listExprToAst(expr, renderContext, exprNodeToAst);
    case "array":
      return arrayExprToAst(expr, renderContext, exprNodeToAst);
    case "window":
      return windowExprToAst(expr, renderContext, exprNodeToAst);
    case "case":
      return caseExprToAst(expr, renderContext, exprNodeToAst);
    default:
      return assertNever(expr);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected expression node: ${JSON.stringify(value)}`);
}
