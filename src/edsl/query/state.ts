import type {
  CteSpec,
  QuerySpec,
  ScopeId,
  Source,
  SqlIdentifier,
  Stage,
} from "../core/types.ts";
import type { ColumnRefs } from "../expr.ts";
import { columnNamesToIdentifierMap } from "./utils.ts";

export type QueryState<TColumns extends Record<string, any>> = {
  source: Source;
  stages: Stage[];
  columns: ColumnRefs<TColumns>;
  columnNames: readonly string[];
  sourceScopeId: ScopeId;
  scopeId: ScopeId;
  withs: CteSpec[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
};

export type QueryInit<TColumns extends Record<string, any>> = {
  source: Source;
  stages: Stage[];
  columns: ColumnRefs<TColumns>;
  columnNames: readonly string[];
  sourceScopeId: ScopeId;
  scopeId: ScopeId;
  withs?: CteSpec[];
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
};

export type QueryDeriveInit<TColumns extends Record<string, any>> = Omit<
  QueryInit<TColumns>,
  "source" | "sourceScopeId" | "scopeId" | "withs" | "columnIdentifiers"
> & {
  source?: Source;
  sourceScopeId?: ScopeId;
  scopeId?: ScopeId;
  withs?: CteSpec[];
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
};

export function resolveQueryInitDefaults<TColumns extends Record<string, any>>(
  init: QueryInit<TColumns>
): QueryState<TColumns> {
  return {
    source: init.source,
    stages: init.stages,
    columns: init.columns,
    columnNames: init.columnNames,
    sourceScopeId: init.sourceScopeId,
    scopeId: init.scopeId,
    withs: init.withs ?? [],
    columnIdentifiers: init.columnIdentifiers ?? columnNamesToIdentifierMap(init.columnNames),
  };
}

export function resolveDerivedQueryInit<
  TCurrentColumns extends Record<string, any>,
  TNextColumns extends Record<string, any>,
>(
  current: QueryState<TCurrentColumns>,
  init: QueryDeriveInit<TNextColumns>
): QueryInit<TNextColumns> {
  return {
    source: init.source ?? current.source,
    stages: init.stages,
    columns: init.columns,
    columnNames: init.columnNames,
    sourceScopeId: init.sourceScopeId ?? current.sourceScopeId,
    scopeId: init.scopeId ?? current.scopeId,
    withs: init.withs ?? current.withs,
    columnIdentifiers: init.columnIdentifiers ?? current.columnIdentifiers,
  };
}

export function toQuerySpec<TColumns extends Record<string, any>>(
  query: Pick<
    QueryState<TColumns>,
    "source" | "stages" | "columnNames" | "columnIdentifiers" | "sourceScopeId"
  >
): QuerySpec {
  return {
    source: query.source,
    stages: query.stages,
    columnNames: query.columnNames,
    columnIdentifiers: query.columnIdentifiers,
    scopeId: query.sourceScopeId,
  };
}
