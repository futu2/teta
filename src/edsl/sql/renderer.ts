import { Parser, type AST, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, Source, Stage } from "../core/types";
import { buildSqlOptions } from "./dialect";
import { applyDialectLanguage } from "./language";
import type {
  QueryDialect,
  SqlRenderer,
  SqlFormat,
  SqlOptions,
  SqlResult,
} from "./types";
import { applyDialectFixes } from "./render/fixes";
import { formatSqlPretty, stripRedundantQuotes } from "./render/format";
import { renderPipelineAst } from "./render/pipeline";
import { exprToAst } from "./render/render";

export type QuerySqlTarget = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[] | null;
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
  };

  return {
    toSql(target: SqlCompilable): SqlResult {
      return isExprSqlTarget(target)
        ? renderExprTarget(target, state)
        : renderQueryTarget(target, state);
    },
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
  const ast = applyDialectFixes(
    renderPipelineAst(target.source, target.stages, target.columnNames, {
      baseCtes: target.withs ?? [],
      dialect: state.dialect,
    }),
    state.dialect
  );

  return {
    sql: renderAst(ast, state),
    params: [],
  };
}

function renderExprTarget(
  target: ExprSqlTarget,
  state: RendererState
): SqlResult {
  const expr = applyDialectLanguage(target.node, state.dialect);

  return {
    sql: renderExprNode(expr, state),
    params: [],
  };
}

function renderAst(ast: AST, state: RendererState): string {
  return finalizeSql(state.parser.sqlify(ast, state.options), state.sqlFormat);
}

function renderExprNode(expr: ExprNode<unknown>, state: RendererState): string {
  return finalizeSql(
    state.parser.exprToSQL(exprToAst(expr), state.options),
    state.sqlFormat
  );
}

function finalizeSql(sql: string, sqlFormat: SqlFormat): string {
  const cleaned = stripRedundantQuotes(sql);
  return sqlFormat === "pretty" ? formatSqlPretty(cleaned) : cleaned;
}

function isExprSqlTarget(value: SqlCompilable): value is ExprSqlTarget {
  return "node" in value;
}
