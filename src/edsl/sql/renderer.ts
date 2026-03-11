import nodeSqlParser from "node-sql-parser";
const { Parser } = nodeSqlParser;
import { buildSqlOptions } from "./dialect.ts";
import {
  isExprSqlTarget,
  renderExprTarget,
  renderQueryTarget,
} from "./renderer_target.ts";
import type {
  RendererState,
  SqlCompilable,
} from "./renderer_types.ts";
import type { SqlOptions, SqlResult } from "./types.ts";

export type {
  ExprSqlTarget,
  QuerySqlTarget,
  SqlCompilable,
} from "./renderer_types.ts";

export function renderSqlResult<TTarget extends SqlCompilable, TResult extends SqlResult = SqlResult>(
  target: TTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return (isExprSqlTarget(target)
    ? renderExprTarget(target, state)
    : renderQueryTarget(target, state)) as TResult;
}

export function renderSql<TTarget extends SqlCompilable>(
  target: TTarget,
  options: SqlOptions = {}
): string {
  return renderSqlResult(target, options).sql;
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
