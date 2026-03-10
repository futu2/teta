import nodeSqlParser from "node-sql-parser";
const { Parser } = nodeSqlParser;
import { buildSqlOptions } from "./dialect.ts";
import type {
  QueryDialect,
  SqlRenderer,
  SqlResult,
} from "./types.ts";
import {
  isExprSqlTarget,
  renderExprTarget,
  renderQueryTarget,
} from "./renderer_target.ts";
import type {
  BuiltinSqlRendererOptions,
  RendererState,
  SqlCompilable,
} from "./renderer_types.ts";

export type {
  BuiltinSqlRendererOptions,
  ExprSqlTarget,
  QuerySqlTarget,
  SqlCompilable,
} from "./renderer_types.ts";

export function sqlRenderer(
  options = {}
): SqlRenderer<SqlCompilable, SqlResult> {
  return createRendererState(options);
}

export function renderSqlResult<TTarget extends SqlCompilable, TResult extends SqlResult = SqlResult>(
  target: TTarget,
  renderer: SqlRenderer<TTarget, TResult>
): TResult {
  return (isExprSqlTarget(target)
    ? renderExprTarget(target, renderer)
    : renderQueryTarget(target, renderer)) as TResult;
}

export function renderSql<TTarget extends SqlCompilable>(
  target: TTarget,
  renderer: SqlRenderer<TTarget, SqlResult>
): string {
  return renderSqlResult(target, renderer).sql;
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

function createRendererState(options: Parameters<typeof buildSqlOptions>[0]): RendererState {
  const resolved = buildSqlOptions(options);
  return {
    parser: new Parser(),
    dialect: resolved.dialect,
    options: resolved.options,
    sqlFormat: resolved.sqlFormat,
    renderStrategy: resolved.renderStrategy,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };
}
