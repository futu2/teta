import {
  columnNamesToIdentifierMap,
  exprToSql,
  exprToSqlResult,
  irToSql,
  irToSqlResult,
  type CteSpec,
  type ExprSqlTarget,
  type QueryIRSqlTarget,
  type ScopeId,
  type Source,
  type SqlOptions,
  type SqlIdentifier,
  type SqlResult,
  type Stage,
} from "@teta/sql";
import { userError } from "@teta/sql";
import { isExpr } from "./core/expr.ts";

export * from "@teta/sql";
export {
  exprToSql as renderExprSql,
  exprToSqlResult as renderExprSqlResult,
};

export type SqlCompilable = QuerySqlTarget | ExprSqlTarget;

export type QuerySqlTarget = {
  version: 1;
  source: Source;
  stages: readonly Stage[];
  columnNames: readonly string[];
  sourceScopeId?: ScopeId;
  scopeId?: ScopeId;
  withs?: readonly CteSpec[];
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
};

export function renderSql<TTarget extends SqlCompilable>(
  target: TTarget,
  options: SqlOptions = {}
): string {
  return isQuerySqlTarget(target)
    ? irToSql(toBackendTarget(target), options)
    : exprToSql(toBackendExprTarget(target as ExprSqlTarget), options);
}

export function renderSqlResult<TResult extends SqlResult = SqlResult>(
  target: SqlCompilable,
  options: SqlOptions = {}
): TResult {
  return (isQuerySqlTarget(target)
    ? irToSqlResult(toBackendTarget(target), options)
    : exprToSqlResult(toBackendExprTarget(target as ExprSqlTarget), options)) as TResult;
}

function isQuerySqlTarget(value: SqlCompilable): value is QuerySqlTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "stages" in value &&
    "columnNames" in value
  );
}

function toBackendTarget(target: QuerySqlTarget): QueryIRSqlTarget {
  const scopeId = target.sourceScopeId ?? target.scopeId;
  if (!scopeId) {
    userError("QUERY_SQL_TARGET_MISSING_SCOPE", "Query SQL target is missing scopeId");
  }
  return {
    version: target.version,
    source: target.source,
    stages: target.stages,
    columnNames: target.columnNames,
    scopeId,
    columnIdentifiers: target.columnIdentifiers ?? columnNamesToIdentifierMap(target.columnNames),
    withs: target.withs,
  };
}

function toBackendExprTarget(target: ExprSqlTarget): ExprSqlTarget {
  return isExpr(target) ? target.node : target;
}
