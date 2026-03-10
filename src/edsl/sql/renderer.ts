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
  const state = createRendererState(options);

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
