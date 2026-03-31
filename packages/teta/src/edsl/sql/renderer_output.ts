import type { AST } from "node-sql-parser";
import type { ExprNode } from "../core/types.ts";
import type { SqlFormat } from "./types.ts";
import { formatSqlPretty, stripRedundantQuotes } from "./render/format.ts";
import { restoreQuotedIdentifiers } from "./render/identifiers.ts";
import { exprToAst } from "./render/render.ts";
import type { SqlRenderContext } from "./render/types.ts";
import type { RendererState } from "./renderer_types.ts";

export function createRenderContext(
  state: Pick<RendererState, "parameterMode" | "parameterPrefix">
): SqlRenderContext {
  return {
    mode: "sql",
    parameterMode: state.parameterMode,
    parameterPrefix: state.parameterPrefix,
    params: [],
    quotedIdentifiers: [],
    identifierBindings: {},
    columnIdentifierBindings: {},
    cteNameBindings: {},
    nextInternalCteIndex: 0,
  };
}

export function renderAst(
  ast: AST,
  state: Pick<RendererState, "parser" | "options" | "sqlFormat">,
  renderContext: SqlRenderContext
): string {
  return finalizeSql(state.parser.sqlify(ast, state.options), state.sqlFormat, renderContext);
}

export function renderExprNode(
  expr: ExprNode<unknown>,
  state: Pick<RendererState, "parser" | "options" | "sqlFormat">,
  renderContext: SqlRenderContext
): string {
  return finalizeSql(
    state.parser.exprToSQL(exprToAst(expr), state.options),
    state.sqlFormat,
    renderContext
  );
}

function finalizeSql(
  sql: string,
  sqlFormat: SqlFormat,
  renderContext: SqlRenderContext
): string {
  const cleaned = restoreQuotedIdentifiers(stripRedundantQuotes(sql), renderContext);
  return sqlFormat === "pretty" ? formatSqlPretty(cleaned) : cleaned;
}
