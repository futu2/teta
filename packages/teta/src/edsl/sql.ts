import {
  exprToSql,
  exprToSqlResult,
  irToSql,
  irToSqlResult,
  type ExprSqlTarget,
  type QueryIRSqlTarget,
  type ScopeId,
  type SqlOptions,
  type SqlResult,
} from "@teta/sql";

export * from "@teta/sql";
export {
  exprToSql as renderExprSql,
  exprToSqlResult as renderExprSqlResult,
};

export type SqlCompilable = QuerySqlTarget | ExprSqlTarget;

export type QuerySqlTarget = QueryIRSqlTarget & {
  sourceScopeId?: ScopeId;
};

export function renderSql<TTarget extends SqlCompilable>(
  target: TTarget,
  options: SqlOptions = {}
): string {
  return isQuerySqlTarget(target)
    ? irToSql(toBackendTarget(target), options)
    : exprToSql(target as ExprSqlTarget, options);
}

export function renderSqlResult<TResult extends SqlResult = SqlResult>(
  target: SqlCompilable,
  options: SqlOptions = {}
): TResult {
  return (isQuerySqlTarget(target)
    ? irToSqlResult(toBackendTarget(target), options)
    : exprToSqlResult(target as ExprSqlTarget, options)) as TResult;
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
    throw new Error("Query SQL target is missing scopeId");
  }
  return {
    ...target,
    scopeId,
  };
}
