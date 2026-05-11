import type { AST } from "node-sql-parser";
import nodeSqlParser from "node-sql-parser";

import { buildSqlOptions } from "./dialect.ts";
import { applyDialectFixes } from "./render/fixes.ts";
import { renderPipelineAst } from "./render/pipeline.ts";
import {
  renderExprTarget,
  renderQueryIRTarget,
} from "./renderer_target.ts";
import type {
  ExprSqlTarget,
  QueryIRSqlTarget,
  RendererState,
} from "./renderer_types.ts";
import type { SqlOptions, SqlResult } from "./types.ts";

const { Parser } = nodeSqlParser;

export type {
  ExprSqlTarget,
  QueryIRSqlTarget,
} from "./renderer_types.ts";

export function irToSqlResult<TResult extends SqlResult = SqlResult>(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderQueryIRTarget(target, state) as TResult;
}

export function irToSql(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): string {
  return irToSqlResult(target, options).sql;
}

export function exprToSqlResult<TResult extends SqlResult = SqlResult>(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderExprTarget(target, state) as TResult;
}

export function exprToSql(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): string {
  return exprToSqlResult(target, options).sql;
}

export function irToAst(
  target: QueryIRSqlTarget,
  options: Pick<SqlOptions, "dialect" | "renderStrategy"> = {}
): AST {
  const resolved = buildSqlOptions(options);
  return applyDialectFixes(
    renderPipelineAst(
      target.source,
      target.stages,
      target.columnNames,
      target.scopeId,
      {
        baseCtes: target.withs ?? [],
        dialect: resolved.dialect,
        renderStrategy: resolved.renderStrategy,
      }
    ),
    resolved.dialect
  );
}

export function explainIR(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
) {
  const resolved = buildSqlOptions(options);
  const sqlResult = irToSqlResult(target, options);
  return {
    ir: target,
    ast: irToAst(target, options),
    sql: sqlResult.sql,
    params: sqlResult.params,
    columnNames: target.columnNames,
    stages: target.stages.map((stage, index) => ({ index, kind: stage.kind })),
    ctes: (target.withs ?? []).map((cte) => ({ name: cte.name, kind: cte.kind })),
    dialect: resolved.dialect,
    format: resolved.sqlFormat,
    renderStrategy: resolved.renderStrategy,
    parameterMode: resolved.parameterMode,
    parameterPrefix: resolved.parameterPrefix,
  };
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
