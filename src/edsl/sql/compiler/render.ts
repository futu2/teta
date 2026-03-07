import type { ExprNode, OrderItem, Value } from "../../core/types";
import type { QueryDialect } from "../types";
import { applyDialectLanguage } from "../language";
import { getDefaultDialect } from "../dialect";
export function stripTableRefs(
  expr: ExprNode<unknown>,
  keepTables?: Set<string>
): ExprNode<unknown> {
  switch (expr.kind) {
    case "column":
      if (!expr.table) return expr;
      if (keepTables && keepTables.has(expr.table)) return expr;
      return { ...expr, table: null };
    case "binary":
      return {
        ...expr,
        left: stripTableRefs(expr.left, keepTables),
        right: stripTableRefs(expr.right, keepTables),
      };
    case "unary":
      return { ...expr, expr: stripTableRefs(expr.expr, keepTables) };
    case "agg":
      return { ...expr, arg: stripTableRefs(expr.arg, keepTables) };
    case "group":
      return { ...expr, expr: stripTableRefs(expr.expr, keepTables) };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => stripTableRefs(arg, keepTables)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => stripTableRefs(item, keepTables)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => stripTableRefs(item, keepTables)),
      };
    case "extract":
      return {
        ...expr,
        source: stripTableRefs(expr.source, keepTables),
      };
    case "cast":
      return {
        ...expr,
        expr: stripTableRefs(expr.expr, keepTables),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => stripTableRefs(arg, keepTables)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => stripTableRefs(arg, keepTables))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: stripTableRefs(item.expr, keepTables),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: stripTableRefs(item.when, keepTables),
          then: stripTableRefs(item.then, keepTables),
        })),
        elseExpr: expr.elseExpr
          ? stripTableRefs(expr.elseExpr, keepTables)
          : null,
      };
    default:
      return expr;
  }
}

export function qualifyMissingTables(
  expr: ExprNode<unknown>,
  table: string
): ExprNode<unknown> {
  switch (expr.kind) {
    case "column":
      if (expr.table) return expr;
      return { ...expr, table };
    case "binary":
      return {
        ...expr,
        left: qualifyMissingTables(expr.left, table),
        right: qualifyMissingTables(expr.right, table),
      };
    case "unary":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "agg":
      return {
        ...expr,
        arg: qualifyMissingTables(expr.arg, table),
      };
    case "group":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => qualifyMissingTables(arg, table)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => qualifyMissingTables(item, table)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => qualifyMissingTables(item, table)),
      };
    case "extract":
      return {
        ...expr,
        source: qualifyMissingTables(expr.source, table),
      };
    case "cast":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => qualifyMissingTables(arg, table)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => qualifyMissingTables(arg, table))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: qualifyMissingTables(item.expr, table),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: qualifyMissingTables(item.when, table),
          then: qualifyMissingTables(item.then, table),
        })),
        elseExpr: expr.elseExpr
          ? qualifyMissingTables(expr.elseExpr, table)
          : null,
      };
    default:
      return expr;
  }
}

export function qualifyForBase(
  expr: ExprNode<unknown>,
  baseAlias: string,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect()
): ExprNode<unknown> {
  return applyDialectLanguage(
    qualifyMissingTables(stripTableRefs(expr, keepTables), baseAlias),
    dialect
  );
}

const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

export function exprToAst(expr: ExprNode<unknown>): unknown {
  switch (expr.kind) {
    case "column":
      return {
        type: "column_ref",
        table: expr.table,
        column: expr.name,
        collate: null,
      };
    case "literal":
      return literalToAst(expr.value);
    case "binary":
      return {
        type: "binary_expr",
        operator: expr.op,
        left: exprToAst(expr.left),
        right: exprToAst(expr.right),
      };
    case "unary":
      return {
        type: "unary_expr",
        operator: expr.op,
        expr: exprToAst(expr.expr),
      };
    case "agg":
      return {
        type: "aggr_func",
        name: expr.name,
        args: {
          distinct: expr.distinct ? "DISTINCT" : null,
          expr: exprToAst(expr.arg),
          orderby: null,
          separator: null,
        },
        over: null,
      };
    case "group":
      return exprToAst(expr.expr);
    case "extract":
      return {
        type: "extract",
        args: {
          field: expr.field.toLowerCase(),
          cast_type: null,
          source: exprToAst(expr.source),
        },
      };
    case "cast":
      return {
        type: "cast",
        keyword: "cast",
        expr: exprToAst(expr.expr),
        symbol: "as",
        target: [{ dataType: expr.target.toUpperCase() }],
      };
    case "func": {
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
              exprToAst(expr.args[0]!),
              { type: "origin", value: "in" },
              exprToAst(expr.args[1]!),
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
          value: expr.args.map(exprToAst),
        },
        over: null,
      };
    }
    case "list":
      return {
        type: "expr_list",
        value: expr.items.map(exprToAst),
      };
    case "array":
      return {
        type: "array",
        keyword: "array",
        expr_list: {
          type: "expr_list",
          value: expr.items.map(exprToAst),
        },
        brackets: true,
      };
    case "window":
      return {
        type: "function",
        name: {
          name: [{ type: "default", value: expr.name.toLowerCase() }],
        },
        args: {
          type: "expr_list",
          value: expr.args.map(exprToAst),
        },
        over: buildWindowOver(expr.partitionBy, expr.orderBy),
      };
    case "case": {
      const whens = expr.whens.map((item) => ({
        type: "when",
        cond: exprToAst(item.when),
        result: exprToAst(item.then),
      }));
      const args = expr.elseExpr
        ? [
            ...whens,
            {
              type: "else",
              result: exprToAst(expr.elseExpr),
            },
          ]
        : whens;
      return {
        type: "case",
        expr: null,
        args,
      };
    }
    default:
      return assertNever(expr);
  }
}

function literalToAst(value: Value): unknown {
  if (value === null) return { type: "null", value: null };
  if (typeof value === "object") {
    switch (value.kind) {
      case "date_literal":
        return { type: "date", value: value.value };
      case "timestamp_literal":
        return { type: "timestamp", value: value.value };
      default:
        return assertNever(value);
    }
  }
  switch (typeof value) {
    case "string":
      return { type: "string", value };
    case "number":
      return { type: "number", value };
    case "boolean":
      return { type: "bool", value };
    default:
      return assertNever(value);
  }
}

function buildWindowOver(
  partitionBy: ExprNode<unknown>[] | null,
  orderBy: OrderItem[] | null
): unknown {
  return {
    type: "window",
    as_window_specification: {
      window_specification: {
        name: null,
        partitionby: partitionBy
          ? partitionBy.map((expr) => ({ expr: exprToAst(expr), as: null }))
          : null,
        orderby: orderBy
          ? orderBy.map((item) => ({
              expr: exprToAst(item.expr),
              type: item.direction,
            }))
          : null,
        window_frame_clause: null,
      },
      parentheses: true,
    },
  };
}

export function lateralJoinPrefix(
  lateral: boolean | undefined,
  dialect: QueryDialect
): "lateral" | undefined {
  if (!lateral) return undefined;
  return dialect.features.lateralJoinKeyword ? "lateral" : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
