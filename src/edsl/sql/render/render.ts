import {
  OUTER_TABLE_ALIAS,
  isInternalScopeName,
  type ExprNode,
  type OrderItem,
  type Value,
} from "../../core/types";
import type { QueryDialect } from "../types";
import { applyDialectLanguage } from "../language";
import { getDefaultDialect } from "../dialect";
import type { ScopeBindings, SqlRenderContext } from "./types";

let activeRenderContext: SqlRenderContext | null = null;

export function getSqlRenderContext(): SqlRenderContext | null {
  return activeRenderContext;
}

export function createAstRenderContext(): SqlRenderContext {
  return {
    mode: "ast",
    parameterMode: "inline",
    parameterPrefix: ":",
    params: [],
    quotedIdentifiers: [],
    identifierBindings: {},
    columnIdentifierBindings: {},
  };
}

export function withSqlRenderContext<T>(
  context: SqlRenderContext,
  render: () => T
): T {
  const previous = activeRenderContext;
  activeRenderContext = context;
  try {
    return render();
  } finally {
    activeRenderContext = previous;
  }
}

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
          when: resolveExprScopes(item.when, scopeBindings),
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
  if (!(expr.table in scopeBindings)) {
    throw new Error(`Missing SQL scope binding for ${expr.table}.${expr.name}`);
  }
  const boundTable = scopeBindings[expr.table];
  return {
    ...expr,
    table: boundTable ?? null,
  };
}
const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

export function exprToAst(
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null = activeRenderContext
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
        left: exprToAst(expr.left, renderContext),
        right: exprToAst(expr.right, renderContext),
      };
    case "unary":
      return {
        type: "unary_expr",
        operator: expr.op,
        expr: exprToAst(expr.expr, renderContext),
      };
    case "agg":
      return {
        type: "aggr_func",
        name: expr.name,
        args: {
          distinct: expr.distinct ? "DISTINCT" : null,
          expr: exprToAst(expr.arg, renderContext),
          orderby: null,
          separator: null,
        },
        over: null,
      };
    case "group":
      return exprToAst(expr.expr, renderContext);
    case "extract":
      return {
        type: "extract",
        args: {
          field: expr.field.toLowerCase(),
          cast_type: null,
          source: exprToAst(expr.source, renderContext),
        },
      };
    case "cast":
      return {
        type: "cast",
        keyword: "cast",
        expr: exprToAst(expr.expr, renderContext),
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
              exprToAst(expr.args[0]!, renderContext),
              { type: "origin", value: "in" },
              exprToAst(expr.args[1]!, renderContext),
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
          value: expr.args.map((item) => exprToAst(item, renderContext)),
        },
        over: null,
      };
    }
    case "list":
      return {
        type: "expr_list",
        value: expr.items.map((item) => exprToAst(item, renderContext)),
      };
    case "array":
      return {
        type: "array",
        keyword: "array",
        expr_list: {
          type: "expr_list",
          value: expr.items.map((item) => exprToAst(item, renderContext)),
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
          value: expr.args.map((item) => exprToAst(item, renderContext)),
        },
        over: buildWindowOver(expr.partitionBy, expr.orderBy, renderContext),
      };
    case "case": {
      const whens = expr.whens.map((item) => ({
        type: "when",
        cond: exprToAst(item.when, renderContext),
        result: exprToAst(item.then, renderContext),
      }));
      const args = expr.elseExpr
        ? [
            ...whens,
            {
              type: "else",
              result: exprToAst(expr.elseExpr, renderContext),
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

function literalToAst(
  value: Value,
  renderContext: SqlRenderContext | null
): unknown {
  if (
    renderContext?.mode === "sql" &&
    renderContext.parameterMode === "named" &&
    value !== null
  ) {
    return parameterizeLiteral(value, renderContext);
  }
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

function parameterizeLiteral(
  value: Exclude<Value, null>,
  renderContext: SqlRenderContext
): { type: "param"; value: string; prefix: string } {
  const index = renderContext.params.length + 1;
  const name = `p${index}`;
  renderContext.params.push({
    val: parameterValue(value),
    index,
    name,
  });
  return {
    type: "param",
    value: name,
    prefix: renderContext.parameterPrefix,
  };
}

function parameterValue(value: Exclude<Value, null>): unknown {
  if (typeof value === "object") {
    return value.value;
  }
  return value;
}

function buildWindowOver(
  partitionBy: ExprNode<unknown>[] | null,
  orderBy: OrderItem[] | null,
  renderContext: SqlRenderContext | null
): unknown {
  return {
    type: "window",
    as_window_specification: {
      window_specification: {
        name: null,
        partitionby: partitionBy
          ? partitionBy.map((expr) => ({ expr: exprToAst(expr, renderContext), as: null }))
          : null,
        orderby: orderBy
          ? orderBy.map((item) => ({
              expr: exprToAst(item.expr, renderContext),
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
  throw new Error(`Unexpected expression node: ${JSON.stringify(value)}`);
}
