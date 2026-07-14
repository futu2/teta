import type { ExprNode } from "../ir/types.ts";
import type {
  AggrFuncAst,
  BinaryExprAst,
  CastAst,
  ColumnRefAst,
  ExtractAst,
  ParserExprAst,
  SqlRenderContext,
  UnaryExprAst,
} from "./types.ts";
import { literalToAst, paramToAst } from "./expr_ast_literal.ts";
import { internalError } from "../errors.ts";
import {
  arrayExprToAst,
  caseExprToAst,
  funcExprToAst,
  listExprToAst,
  windowExprToAst,
} from "./expr_ast_compound.ts";

export function exprNodeToAst(
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null
): ParserExprAst {
  switch (expr.kind) {
    case "column": {
      const table: ColumnRefAst["table"] =
        expr.table === null
          ? null
          : (renderContext?.identifierBindings[expr.table] ?? expr.table);
      const column: ColumnRefAst["column"] =
        expr.table === null
          ? expr.name
          : (renderContext?.columnIdentifierBindings[`${expr.table}.${expr.name}`] ?? expr.name);
      const columnRef: ColumnRefAst = {
        type: "column_ref",
        table,
        column,
        collate: null,
      };
      return columnRef;
    }
    case "literal":
      return literalToAst(expr.value, renderContext);
    case "param":
      return paramToAst(expr.name, renderContext);
    case "binary": {
      const binaryExpr: BinaryExprAst = {
        type: "binary_expr",
        operator: expr.op,
        left: renderBinaryOperand(expr.left, expr.op, "left", renderContext),
        right: renderBinaryOperand(expr.right, expr.op, "right", renderContext),
      };
      return binaryExpr;
    }
    case "unary": {
      const unaryExpr: UnaryExprAst = {
        type: "unary_expr",
        operator: expr.op,
        expr: renderUnaryOperand(expr.expr, renderContext),
      };
      return unaryExpr;
    }
    case "agg": {
      const aggregateExpr: AggrFuncAst = {
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
      return aggregateExpr;
    }
    case "group":
      return parenthesizeAst(exprNodeToAst(expr.expr, renderContext));
    case "extract": {
      const extractExpr: ExtractAst = {
        type: "extract",
        args: {
          field: expr.field.toLowerCase(),
          cast_type: null,
          source: exprNodeToAst(expr.source, renderContext),
        },
      };
      return extractExpr;
    }
    case "cast": {
      const castExpr: CastAst = {
        type: "cast",
        keyword: "cast",
        expr: exprNodeToAst(expr.expr, renderContext),
        symbol: "as",
        target: [{ dataType: expr.target.toUpperCase() }],
      };
      return castExpr;
    }
    case "builtin":
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
  internalError("INTERNAL_UNEXPECTED_EXPRESSION_NODE", `Unexpected expression node: ${JSON.stringify(value)}`);
}

function renderBinaryOperand(
  expr: ExprNode<unknown>,
  parentOp: BinaryExprAst["operator"],
  side: "left" | "right",
  renderContext: SqlRenderContext | null
): ParserExprAst {
  const ast = exprNodeToAst(expr, renderContext);
  const normalized = unwrapGroups(expr);
  if (
    side === "right" &&
    parentOp === "BETWEEN" &&
    normalized.kind === "binary" &&
    normalized.op === "AND"
  ) {
    return ast;
  }
  if (
    normalized.kind === "binary" &&
    binaryOperandNeedsParentheses(parentOp, normalized.op, side)
  ) {
    return parenthesizeAst(ast);
  }
  return ast;
}

function renderUnaryOperand(
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null
): ParserExprAst {
  const ast = exprNodeToAst(expr, renderContext);
  return unwrapGroups(expr).kind === "binary" ? parenthesizeAst(ast) : ast;
}

function binaryOperandNeedsParentheses(
  parentOp: BinaryExprAst["operator"],
  childOp: BinaryExprAst["operator"],
  side: "left" | "right"
): boolean {
  const parentPrecedence = binaryPrecedence(parentOp);
  const childPrecedence = binaryPrecedence(childOp);

  if (childPrecedence !== parentPrecedence) {
    return childPrecedence < parentPrecedence;
  }

  if (parentPrecedence === 3) return true;

  // SQL binary operators associate left-to-right. A same-precedence expression
  // on the right therefore needs grouping unless the operation can be flattened.
  return side === "right" && !isAssociativeChain(parentOp, childOp);
}

function isAssociativeChain(
  parentOp: BinaryExprAst["operator"],
  childOp: BinaryExprAst["operator"]
): boolean {
  return (
    parentOp === childOp &&
    (parentOp === "AND" || parentOp === "OR" || parentOp === "||")
  );
}

function parenthesizeAst(ast: ParserExprAst): ParserExprAst {
  switch (ast.type) {
    case "binary_expr":
      return {
        ...ast,
        parentheses: true,
      };
    case "expr_list":
      return {
        ...ast,
        parentheses: true,
      };
    default:
      return ast;
  }
}

function unwrapGroups(expr: ExprNode<unknown>): ExprNode<unknown> {
  let current = expr;
  while (current.kind === "group") {
    current = current.expr;
  }
  return current;
}

function binaryPrecedence(op: BinaryExprAst["operator"]): number {
  switch (op) {
    case "OR":
      return 1;
    case "AND":
      return 2;
    case "=":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "LIKE":
    case "IS":
    case "IS NOT":
    case "IN":
    case "NOT IN":
    case "BETWEEN":
    case "IS DISTINCT FROM":
      return 3;
    case "||":
      return 4;
    case "+":
    case "-":
      return 5;
    case "*":
    case "/":
      return 6;
    default:
      return 0;
  }
}
