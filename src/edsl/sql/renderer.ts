import { Parser, type AST, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, Source, Stage } from "../core/types";
import { buildSqlOptions } from "./dialect";
import { applyDialectLanguage } from "./language";
import type {
  QueryDialect,
  SqlRenderer,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlResult,
} from "./types";
import { applyDialectFixes } from "./render/fixes";
import { formatSqlPretty, stripRedundantQuotes } from "./render/format";
import { restoreQuotedIdentifiers } from "./render/identifiers";
import { renderPipelineAst } from "./render/pipeline";
import { exprToAst, withSqlRenderContext } from "./render/render";
import type { SqlRenderContext } from "./render/types";

export type QuerySqlTarget = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[] | null;
  sourceScopeId: string;
  withs?: CteSpec[];
};

export type ExprSqlTarget = {
  node: ExprNode<unknown>;
};

export type SqlCompilable = QuerySqlTarget | ExprSqlTarget;

export type BuiltinSqlRendererOptions = Omit<SqlOptions, "dialect">;

type RendererState = {
  parser: Parser;
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};

export function sqlRenderer(
  options: SqlOptions = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  const resolved = buildSqlOptions(options);
  const state: RendererState = {
    parser: new Parser(),
    dialect: resolved.dialect,
    options: resolved.options,
    sqlFormat: resolved.sqlFormat,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };

  const toSqlResult = (target: SqlCompilable): SqlResult => {
    return isExprSqlTarget(target)
      ? renderExprTarget(target, state)
      : renderQueryTarget(target, state);
  };

  return {
    toSql(target: SqlCompilable): string {
      return toSqlResult(target).sql;
    },
    toSqlResult,
  };
}

export function duckdbRenderer(
  options: BuiltinSqlRendererOptions = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  return sqlRenderer({ ...options, dialect: "duckdb" });
}

export function postgresqlRenderer(
  options: BuiltinSqlRendererOptions = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  return sqlRenderer({ ...options, dialect: "postgresql" });
}

export function sqliteRenderer(
  options: BuiltinSqlRendererOptions = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  return sqlRenderer({ ...options, dialect: "sqlite" });
}

export function hetuRenderer(
  options: BuiltinSqlRendererOptions = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  return sqlRenderer({ ...options, dialect: "hetu" });
}

function renderQueryTarget(
  target: QuerySqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const ast = withSqlRenderContext(renderContext, () =>
    applyDialectFixes(
      renderPipelineAst(target.source, target.stages, target.columnNames, target.sourceScopeId, {
        baseCtes: target.withs ?? [],
        dialect: state.dialect,
      }),
      state.dialect
    )
  );

  return {
    sql: renderAst(ast, state, renderContext),
    params: renderContext.params,
  };
}

function renderExprTarget(
  target: ExprSqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const expr = applyDialectLanguage(target.node, state.dialect);

  return {
    sql: withSqlRenderContext(renderContext, () => renderExprNode(expr, state, renderContext)),
    params: renderContext.params,
  };
}

function renderAst(ast: AST, state: RendererState, renderContext: SqlRenderContext): string {
  return finalizeSql(state.parser.sqlify(ast, state.options), state.sqlFormat, renderContext);
}

function renderExprNode(
  expr: ExprNode<unknown>,
  state: RendererState,
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

function createRenderContext(state: RendererState): SqlRenderContext {
  return {
    mode: "sql",
    parameterMode: state.parameterMode,
    parameterPrefix: state.parameterPrefix,
    params: [],
    quotedIdentifiers: [],
    identifierBindings: {},
    columnIdentifierBindings: {},
  };
}

function isExprSqlTarget(value: SqlCompilable): value is ExprSqlTarget {
  return "node" in value;
}
