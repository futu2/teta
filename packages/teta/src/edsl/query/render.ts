import type { CteSpec } from "../core/types.ts";
import type {
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
  irToSql,
  irToSqlResult,
  renderSql,
  renderSqlResult,
} from "../sql.ts";
import { TETA_QUERY_IR_VERSION, toPortableQueryIR } from "@teta/sql";
import type { PortableQueryIR } from "@teta/sql";
import type { SqlCompilable } from "../sql.ts";
import {
  getQueryState,
  freezeQueryValue,
  type AnyQuery,
  type Query,
  type QueryStageKind,
} from "./core.ts";
import { isQuery } from "./value.ts";
import { canonicalizeIR } from "./canonicalize.ts";
import type { QueryColumns } from "./types.ts";

export type QueryIR<TColumns extends QueryColumns> = Readonly<PortableQueryIR & {
  columnNames: readonly (keyof TColumns & string)[];
}>;

export type SqlRenderable = AnyQuery | SqlCompilable;

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
  const state = getQueryState(query);
  return freezeQueryValue(toPortableQueryIR(canonicalizeIR({
    version: TETA_QUERY_IR_VERSION,
    source: state.source,
    stages: state.stages,
    scopeId: state.sourceScopeId,
    columnNames: state.columnNames,
    columnIdentifiers: state.columnIdentifiers,
    withs: state.withs,
  }))) as QueryIR<TColumns>;
}

export function toSql<TTarget extends SqlRenderable>(
  query: TTarget,
  options: SqlOptions = {}
): string {
  return isQuery(query)
    ? irToSql(toIR(query as Query<QueryColumns>), options ?? {})
    : renderSql(query, options ?? {});
}

export function toSqlResult<TTarget extends SqlRenderable>(
  query: TTarget,
  options: SqlOptions = {}
): SqlResult {
  return isQuery(query)
    ? irToSqlResult(toIR(query as Query<QueryColumns>), options ?? {})
    : renderSqlResult(query, options ?? {});
}

export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const result = explainIR(toIR(query), options);

  return {
    ir: result.ir,
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
