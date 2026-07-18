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
import { lowerLogicalCtes, lowerLogicalStages } from "./logical.ts";
import {
  encodePreparedOptions,
  isPreparedQuery,
  type ParameterSchema,
  type PreparedQuery,
  type PreparedSqlOptions,
} from "./prepared.ts";

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

export function toIR<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>
): QueryIR<TColumns>;
export function toIR<TColumns extends QueryColumns>(query: Query<TColumns>): QueryIR<TColumns>;
export function toIR<TColumns extends QueryColumns>(
  target: Query<TColumns> | PreparedQuery<TColumns, ParameterSchema>
): QueryIR<TColumns> {
  const query = isPreparedQuery(target) ? target.query as Query<TColumns> : target;
  const state = getQueryState(query);
  return freezeQueryValue(toPortableQueryIR(canonicalizeIR({
    version: TETA_QUERY_IR_VERSION,
    source: state.source,
    stages: lowerLogicalStages(state.stages, {
      scopeId: state.sourceScopeId,
      columnNames: state.sourceColumnNames,
      columnIdentifiers: state.sourceColumnIdentifiers,
    }),
    scopeId: state.sourceScopeId,
    columnNames: state.columnNames,
    columnIdentifiers: state.columnIdentifiers,
    withs: lowerLogicalCtes(state.withs),
  }))) as QueryIR<TColumns>;
}

export function toSql<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): string;
export function toSql<TTarget extends AnyQuery | SqlCompilable>(
  query: TTarget,
  options?: SqlOptions
): string;
export function toSql(
  target: SqlRenderable | PreparedQuery<QueryColumns, ParameterSchema>,
  options: SqlOptions = {}
): string {
  if (isPreparedQuery(target)) {
    const prepared = target as PreparedQuery<QueryColumns, ParameterSchema>;
    return irToSql(
      toIR(prepared),
      encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
    );
  }
  return isQuery(target)
    ? irToSql(toIR(target as Query<QueryColumns>), options)
    : renderSql(target, options);
}

export function toSqlResult<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): SqlResult;
export function toSqlResult<TTarget extends AnyQuery | SqlCompilable>(
  query: TTarget,
  options?: SqlOptions
): SqlResult;
export function toSqlResult(
  target: SqlRenderable | PreparedQuery<QueryColumns, ParameterSchema>,
  options: SqlOptions = {}
): SqlResult {
  if (isPreparedQuery(target)) {
    const prepared = target as PreparedQuery<QueryColumns, ParameterSchema>;
    return irToSqlResult(
      toIR(prepared),
      encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
    );
  }
  return isQuery(target)
    ? irToSqlResult(toIR(target as Query<QueryColumns>), options)
    : renderSqlResult(target, options);
}

export function explain<TColumns extends QueryColumns, TSchema extends ParameterSchema>(
  query: PreparedQuery<TColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): QueryExplainResult<TColumns>;
export function explain<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: SqlOptions
): QueryExplainResult<TColumns>;
export function explain<TColumns extends QueryColumns>(
  target: Query<TColumns> | PreparedQuery<TColumns, ParameterSchema>,
  options: SqlOptions = {}
): QueryExplainResult<TColumns> {
  const prepared = isPreparedQuery(target)
    ? target as PreparedQuery<TColumns, ParameterSchema>
    : null;
  const ir = prepared ? toIR(prepared) : toIR(target as Query<TColumns>);
  const result = explainIR(
    ir,
    prepared
      ? encodePreparedOptions(prepared, options as PreparedSqlOptions<ParameterSchema>)
      : options
  );

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
