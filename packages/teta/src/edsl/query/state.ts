import type {
  ScopeId,
  Source,
  SqlIdentifier,
} from "../core/types.ts";
import type { ColumnRefs } from "../expr.ts";
import { columnNamesToIdentifierMap } from "./utils.ts";
import type { LogicalCteSpec, LogicalQuerySpec, LogicalStage } from "./logical.ts";

export type QueryNameSupply = Readonly<{
  scope: number;
  cte: number;
}>;

export type QueryState<TColumns extends Record<string, unknown>> = {
  source: Source;
  stages: readonly LogicalStage[];
  columns: ColumnRefs<TColumns>;
  columnNames: readonly string[];
  sourceColumnNames: readonly string[];
  sourceScopeId: ScopeId;
  scopeId: ScopeId;
  withs: readonly LogicalCteSpec[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  sourceColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  nameSupply: QueryNameSupply;
};

export type QueryInit<TColumns extends Record<string, unknown>> = {
  source: Source;
  stages: readonly LogicalStage[];
  columns: ColumnRefs<TColumns>;
  columnNames: readonly string[];
  sourceColumnNames?: readonly string[];
  sourceScopeId: ScopeId;
  scopeId: ScopeId;
  withs?: readonly LogicalCteSpec[];
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  sourceColumnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  nameSupply?: QueryNameSupply;
};

export type QueryDeriveInit<TColumns extends Record<string, unknown>> = Omit<
  QueryInit<TColumns>,
  "source" | "sourceColumnNames" | "sourceScopeId" | "scopeId" | "withs" | "columnIdentifiers" | "sourceColumnIdentifiers"
> & {
  source?: Source;
  sourceColumnNames?: readonly string[];
  sourceScopeId?: ScopeId;
  scopeId?: ScopeId;
  withs?: readonly LogicalCteSpec[];
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  sourceColumnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  nameSupply?: QueryNameSupply;
};

export const INITIAL_QUERY_NAME_SUPPLY: QueryNameSupply = Object.freeze({
  scope: 0,
  cte: 0,
});

export function resolveQueryInitDefaults<TColumns extends Record<string, unknown>>(
  init: QueryInit<TColumns>
): QueryState<TColumns> {
  const columnIdentifiers = init.columnIdentifiers ?? columnNamesToIdentifierMap(init.columnNames);
  return {
    source: init.source,
    stages: init.stages,
    columns: init.columns,
    columnNames: init.columnNames,
    sourceColumnNames: init.sourceColumnNames ?? init.columnNames,
    sourceScopeId: init.sourceScopeId,
    scopeId: init.scopeId,
    withs: init.withs ?? [],
    columnIdentifiers,
    sourceColumnIdentifiers: init.sourceColumnIdentifiers ?? columnIdentifiers,
    nameSupply: init.nameSupply ?? INITIAL_QUERY_NAME_SUPPLY,
  };
}

export function resolveDerivedQueryInit<
  TCurrentColumns extends Record<string, unknown>,
  TNextColumns extends Record<string, unknown>,
>(
  current: QueryState<TCurrentColumns>,
  init: QueryDeriveInit<TNextColumns>
): QueryInit<TNextColumns> {
  return {
    source: init.source ?? current.source,
    stages: init.stages,
    columns: init.columns,
    columnNames: init.columnNames,
    sourceColumnNames: init.sourceColumnNames ?? current.sourceColumnNames,
    sourceScopeId: init.sourceScopeId ?? current.sourceScopeId,
    scopeId: init.scopeId ?? current.scopeId,
    withs: init.withs ?? current.withs,
    columnIdentifiers: init.columnIdentifiers ?? current.columnIdentifiers,
    sourceColumnIdentifiers: init.sourceColumnIdentifiers ?? current.sourceColumnIdentifiers,
    nameSupply: init.nameSupply ?? current.nameSupply,
  };
}

export function toQuerySpec<TColumns extends Record<string, unknown>>(
  query: Pick<
    QueryState<TColumns>,
    "source" | "stages" | "sourceColumnNames" | "sourceColumnIdentifiers" | "columnNames" | "columnIdentifiers" | "sourceScopeId"
  >
): LogicalQuerySpec {
  return {
    source: query.source,
    stages: query.stages,
    sourceColumnNames: query.sourceColumnNames,
    sourceColumnIdentifiers: query.sourceColumnIdentifiers,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    scopeId: query.sourceScopeId,
  };
}
