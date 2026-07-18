import type { SqlIdentifier } from "../core/types.ts";
import { isExprNode } from "../expr.ts";
import { getQueryState, hasQueryBrand } from "./core.ts";
import type { AnyQuery, Query } from "./core.ts";
import type { QueryState } from "./state.ts";
import type { QueryColumns } from "./types.ts";

export function isQuery(value: unknown): value is AnyQuery {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    kind?: unknown;
    columns?: unknown;
  };

  if (!hasQueryBrand(value) || candidate.kind !== "query") {
    return false;
  }

  const state = getQueryState(value as Query<QueryColumns>);
  return isQueryState(state) && candidate.columns === state.columns;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isQueryState(value: unknown): value is Readonly<QueryState<QueryColumns>> {
  if (!isPlainObject(value)) return false;
  const state = value as Partial<QueryState<QueryColumns>>;

  return isSource(state.source)
    && Array.isArray(state.stages)
    && state.stages.every(isStage)
    && isPlainObject(state.columns)
    && isStringArray(state.columnNames)
    && isStringArray(state.sourceColumnNames)
    && typeof state.sourceScopeId === "string"
    && typeof state.scopeId === "string"
    && Array.isArray(state.withs)
    && state.withs.every(isCteSpec)
    && isColumnIdentifiers(state.columnIdentifiers)
    && isColumnIdentifiers(state.sourceColumnIdentifiers)
    && isNameSupply(state.nameSupply);
}

function isSource(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if ((value as { kind?: unknown }).kind === "values") {
    const rows = (value as { rows?: unknown }).rows;
    return Array.isArray(rows) && rows.every(isPlainObject);
  }

  const source = value as {
    db?: unknown;
    schema?: unknown;
    table?: unknown;
    as?: unknown;
  };
  return (source.db === null || isSqlIdentifier(source.db))
    && (source.schema === null || isSqlIdentifier(source.schema))
    && isSqlIdentifier(source.table)
    && (source.as === null || isSqlIdentifier(source.as));
}

function isStage(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const stage = value as {
    kind?: unknown;
    items?: unknown;
    keys?: unknown;
    groupBy?: unknown;
    outputScopeId?: unknown;
    predicate?: unknown;
    outputColumnNames?: unknown;
    outputColumnIdentifiers?: unknown;
    count?: unknown;
    joinType?: unknown;
    lateral?: unknown;
    source?: unknown;
    as?: unknown;
    on?: unknown;
    rightScopeId?: unknown;
    mode?: unknown;
    expr?: unknown;
    withOrdinality?: unknown;
    columnNames?: unknown;
    columnIdentifiers?: unknown;
    op?: unknown;
    right?: unknown;
  };
  switch (stage.kind) {
    case "map":
      return isProjectionItems(stage.items)
        && isStringArray(stage.keys)
        && typeof stage.outputScopeId === "string";
    case "fold":
      return isProjectionItems(stage.items)
        && isStringArray(stage.keys)
        && (stage.groupBy === null || isExprNodeArray(stage.groupBy))
        && typeof stage.outputScopeId === "string";
    case "filter":
      return isExprNode(stage.predicate);
    case "sort":
      return isOrderItems(stage.items);
    case "distinct":
      return true;
    case "take":
      return typeof stage.count === "number";
    case "join":
      return isJoinType(stage.joinType)
        && (stage.lateral === undefined || typeof stage.lateral === "boolean")
        && isJoinSource(stage.source)
        && (stage.as === null || typeof stage.as === "string")
        && isExprNode(stage.on)
        && isProjectionItems(stage.items)
        && isStringArray(stage.outputColumnNames)
        && isColumnIdentifiers(stage.outputColumnIdentifiers)
        && typeof stage.rightScopeId === "string"
        && typeof stage.outputScopeId === "string";
    case "unnest":
      return (stage.mode === "inner" || stage.mode === "outer")
        && isExprNode(stage.expr)
        && typeof stage.withOrdinality === "boolean"
        && (stage.as === null || typeof stage.as === "string")
        && isStringArray(stage.columnNames)
        && isColumnIdentifiers(stage.columnIdentifiers)
        && isProjectionItems(stage.items)
        && typeof stage.rightScopeId === "string"
        && typeof stage.outputScopeId === "string";
    case "union":
      return (stage.op === "union" || stage.op === "union all")
        && isQuerySpec(stage.right)
        && typeof stage.outputScopeId === "string";
    default:
      return false;
  }
}

function isJoinType(value: unknown): boolean {
  return value === "INNER" || value === "LEFT" || value === "RIGHT" || value === "FULL";
}

function isJoinSource(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const source = value as {
    kind?: unknown;
    db?: unknown;
    table?: unknown;
    schema?: unknown;
    columnIdentifiers?: unknown;
    query?: unknown;
    inheritedBindings?: unknown;
  };
  if (source.kind === "table") {
    return (source.db === null || isSqlIdentifier(source.db))
      && isSqlIdentifier(source.table)
      && (source.schema === null || isSqlIdentifier(source.schema))
      && isColumnIdentifiers(source.columnIdentifiers);
  }
  if (source.kind === "subquery") {
    return isQuerySpec(source.query)
      && (source.inheritedBindings === null || isPlainObject(source.inheritedBindings));
  }
  return false;
}

function isProjectionItems(value: unknown): boolean {
  return Array.isArray(value) && value.every(isProjectionItem);
}

function isProjectionItem(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const item = value as { expr?: unknown; as?: unknown };
  return isExprNode(item.expr) && (item.as === null || isSqlIdentifier(item.as));
}

function isOrderItems(value: unknown): boolean {
  return Array.isArray(value) && value.every(isOrderItem);
}

function isOrderItem(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const item = value as { expr?: unknown; direction?: unknown };
  return isExprNode(item.expr) && (item.direction === "ASC" || item.direction === "DESC");
}

function isExprNodeArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isExprNode);
}

function isCteSpec(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const cte = value as {
    kind?: unknown;
    name?: unknown;
    query?: unknown;
    columnNames?: unknown;
    base?: unknown;
    step?: unknown;
  };
  if (cte.kind === "query") {
    return typeof cte.name === "string" && isQuerySpec(cte.query);
  }
  if (cte.kind === "recursive") {
    return typeof cte.name === "string"
      && isStringArray(cte.columnNames)
      && isQuerySpec(cte.base)
      && isQuerySpec(cte.step);
  }
  return false;
}

function isQuerySpec(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const spec = value as {
    source?: unknown;
    stages?: unknown;
    sourceColumnNames?: unknown;
    sourceColumnIdentifiers?: unknown;
    columnNames?: unknown;
    columnIdentifiers?: unknown;
    scopeId?: unknown;
  };
  return isSource(spec.source)
    && Array.isArray(spec.stages)
    && spec.stages.every(isStage)
    && isStringArray(spec.sourceColumnNames)
    && isColumnIdentifiers(spec.sourceColumnIdentifiers)
    && isStringArray(spec.columnNames)
    && isColumnIdentifiers(spec.columnIdentifiers)
    && typeof spec.scopeId === "string";
}

function isColumnIdentifiers(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every(isSqlIdentifier);
}

function isSqlIdentifier(value: unknown): value is SqlIdentifier {
  return isPlainObject(value)
    && typeof (value as { name?: unknown }).name === "string"
    && typeof (value as { quoted?: unknown }).quoted === "boolean";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNameSupply(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const supply = value as { scope?: unknown; cte?: unknown };
  return Number.isInteger(supply.scope)
    && Number.isInteger(supply.cte)
    && (supply.scope as number) >= 0
    && (supply.cte as number) >= 0;
}
