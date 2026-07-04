import type { AST } from "node-sql-parser";
import type { CteSpec } from "../core/types.ts";
import type {
  Dialect,
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
  SqlResult,
} from "../sql/types.ts";
import {
  explainIR,
  irToAst,
  irToSql,
  irToSqlResult,
  renderSql,
  renderSqlResult,
  resolveDialect,
} from "../sql.ts";
import type { QueryIRSqlTarget, SqlCompilable } from "../sql.ts";
import type { Query, QueryStageKind } from "./builder.ts";
import { isQuery } from "./value.ts";
import { canonicalizeIR } from "./canonicalize.ts";

type QueryColumns = Record<string, any>;

export type QueryIR<TColumns extends QueryColumns> = QueryIRSqlTarget & {
  columnNames: readonly (keyof TColumns & string)[];
};

export type QueryExplainStage = {
  index: number;
  kind: QueryStageKind;
};

export type QueryExplainCte = {
  name: string;
  kind: CteSpec["kind"];
};

export type QueryExplainResult<TColumns extends QueryColumns> = {
  ir: QueryIR<TColumns>;
  ast: AST;
  sql: string;
  params: SqlResult["params"];
  columnNames: readonly string[];
  stages: QueryExplainStage[];
  ctes: QueryExplainCte[];
  dialect: QueryDialect;
  format: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};

export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns> {
  return canonicalizeIR({
    source: query.source,
    stages: query.stages,
    scopeId: query.sourceScopeId,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    withs: query.withs,
  }) as QueryIR<TColumns>;
}

export function toAst<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: { dialect?: Dialect; renderStrategy?: SqlRenderStrategy }
): AST {
  return irToAst(toIR(query), {
    dialect: options?.dialect ? resolveDialect(options.dialect) : undefined,
    renderStrategy: options?.renderStrategy,
  });
}

export function toSql<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): string {
  return isQuery(query) ? irToSql(toIR(query), options) : renderSql(query, options);
}

export function toSqlResult<TTarget extends SqlCompilable>(
  query: TTarget,
  options: SqlOptions = {}
): SqlResult {
  return isQuery(query) ? irToSqlResult(toIR(query), options) : renderSqlResult(query, options);
}

export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const result = explainIR(toIR(query), options);

  return {
    ir: result.ir,
    ast: result.ast,
    sql: result.sql,
    params: result.params,
    columnNames: result.columnNames,
    stages: result.stages,
    ctes: result.ctes,
    dialect: result.dialect,
    format: result.format,
    renderStrategy: result.renderStrategy,
    parameterMode: result.parameterMode,
    parameterPrefix: result.parameterPrefix,
  };
}
