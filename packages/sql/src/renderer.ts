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
import type {
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
} from "./types.ts";
import type { CteSpec, Stage } from "./ir/types.ts";

const { Parser } = nodeSqlParser;

export type {
  ExprSqlTarget,
  QueryIRSqlTarget,
} from "./renderer_types.ts";

/** Diagnostic rendering output for a query IR. */
export type ExplainIRResult = {
  /** Original query IR passed to `explainIR`. */
  ir: QueryIRSqlTarget;
  /** Parser AST produced before SQL stringification. */
  ast: AST;
  /** Rendered SQL string. */
  sql: string;
  /** Bound parameters collected while rendering. */
  params: SqlResult["params"];
  /** Output column names exposed by the query. */
  columnNames: readonly string[];
  /** Lowered query stages with their original order. */
  stages: Array<{ index: number; kind: Stage["kind"] }>;
  /** Common table expressions attached to the query. */
  ctes: Array<{ name: string; kind: CteSpec["kind"] }>;
  /** Resolved SQL dialect used for rendering. */
  dialect: QueryDialect;
  /** SQL formatting mode used for rendering. */
  format: SqlFormat;
  /** Query lowering strategy used by the renderer. */
  renderStrategy: SqlRenderStrategy;
  /** Parameter rendering mode used for literals and params. */
  parameterMode: SqlParameterMode;
  /** Placeholder prefix used for named or positional parameters. */
  parameterPrefix: SqlParameterPrefix;
};

/**
 * Render a query IR to SQL plus parameter metadata.
 *
 * Use this when you need both the SQL string and the parameter list for a
 * database client. `irToSql(...)` is the string-only convenience wrapper.
 */
export function irToSqlResult<TResult extends SqlResult = SqlResult>(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderQueryIRTarget(target, state) as TResult;
}

/** Render a query IR to a SQL string. */
export function irToSql(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): string {
  return irToSqlResult(target, options).sql;
}

/**
 * Render a standalone expression target to SQL plus parameter metadata.
 *
 * This is useful for testing expression builders or rendering predicates
 * outside a full query pipeline.
 */
export function exprToSqlResult<TResult extends SqlResult = SqlResult>(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): TResult {
  const state = createRendererState(options);
  return renderExprTarget(target, state) as TResult;
}

/** Render a standalone expression target to a SQL string. */
export function exprToSql(
  target: ExprSqlTarget,
  options: SqlOptions = {}
): string {
  return exprToSqlResult(target, options).sql;
}

/**
 * Lower a query IR to a `node-sql-parser` AST.
 *
 * Use this when integrating with tooling that consumes parser ASTs directly.
 */
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
        columnIdentifiers: target.columnIdentifiers,
        dialect: resolved.dialect,
        renderStrategy: resolved.renderStrategy,
      }
    ),
    resolved.dialect
  );
}

/** Return the rendered SQL, AST, resolved options, stages, and CTE metadata for a query IR. */
export function explainIR(
  target: QueryIRSqlTarget,
  options: SqlOptions = {}
): ExplainIRResult {
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
