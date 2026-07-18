import type { AST } from "node-sql-parser";
import { createDictionary } from "./dictionary.ts";
import type { ExprNode } from "./ir/types.ts";
import type { SqlFormat } from "./types.ts";
import { formatSqlPretty, stripRedundantQuotes } from "./render/format.ts";
import { exprToAst } from "./render/render.ts";
import type { SqlRenderContext } from "./render/types.ts";
import type { RendererState } from "./renderer_types.ts";

export function createRenderContext(
  state: Pick<RendererState, "dialect" | "parameterMode" | "parameterPrefix" | "paramBindings">,
  reservedParameterNames: ReadonlySet<string> = new Set()
): SqlRenderContext {
  return {
    mode: "sql",
    dialect: state.dialect,
    parameterMode: state.parameterMode,
    parameterPrefix: state.parameterPrefix,
    paramBindings: state.paramBindings,
    params: [],
    reservedParameterNames,
    nextAutoParameterIndex: 1,
    identifierBindings: createDictionary(),
    columnIdentifierBindings: createDictionary(),
    cteNameBindings: createDictionary(),
    nextInternalCteIndex: 0,
  };
}

export function renderAst(
  ast: AST,
  state: Pick<RendererState, "parser" | "options" | "sqlFormat" | "dialect">
): string {
  return finalizeSql(
    state.parser.sqlify(ast, state.options),
    state.sqlFormat,
    state.dialect
  );
}

export function renderExprNode(
  expr: ExprNode<unknown>,
  state: Pick<RendererState, "parser" | "options" | "sqlFormat" | "dialect">,
  renderContext: SqlRenderContext
): string {
  return finalizeSql(
    state.parser.exprToSQL(exprToAst(expr, renderContext), state.options),
    state.sqlFormat,
    state.dialect
  );
}

function finalizeSql(
  sql: string,
  sqlFormat: SqlFormat,
  dialect: RendererState["dialect"]
): string {
  const cleaned = stripRedundantQuotes(sql, dialect);
  return sqlFormat === "pretty" ? formatSqlPretty(cleaned) : cleaned;
}
