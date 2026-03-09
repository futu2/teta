import type {
  ExprNode,
  JoinSource,
  JoinTypeInput,
  OrderItem,
  Stage,
} from "../core/types";
import {
  createColumnRefs,
  dedupeExprs,
  selectAllItems,
} from "../expr";
import type {
  ColumnRefs,
  ExprRef,
  SelectSelection,
} from "../expr";
import {
  autoAlias,
  assertUnionCompatible,
  mergeWiths,
  normalizeJoinType,
  selectItemsToIdentifierMap,
} from "./utils";
import {
  freshScopeId,
  resolveAggregateProjection,
  resolveSelectProjection,
} from "./planner";
import {
  resolveJoinColumns,
  type JoinColumnMerger,
} from "./join";
import type {
  QueryDeriveInit,
  QueryState,
} from "./state";
import { toQuerySpec } from "./state";

export function resolveSelectQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  selection: SelectSelection
): QueryDeriveInit<Record<string, unknown>> {
  const { keys, items } = resolveSelectProjection(selection);
  return resolveProjectedQuery(query, {
    kind: "select",
    items,
    keys,
    groupBy: null,
    outputScopeId: freshScopeId(),
  });
}

export function resolveAggregateQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  selection: SelectSelection
): QueryDeriveInit<Record<string, unknown>> {
  const resolved = resolveAggregateProjection(selection);
  const finalGroupBy = dedupeExprs(resolved.groupBy);
  return resolveProjectedQuery(query, {
    kind: "select",
    items: resolved.items,
    keys: resolved.keys,
    groupBy: finalGroupBy.length ? finalGroupBy : null,
    outputScopeId: freshScopeId(),
  });
}

export function resolveFilterQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  predicate: ExprNode<boolean>
): QueryDeriveInit<TColumns> {
  const lastStage = query.stages[query.stages.length - 1];
  if (lastStage?.kind === "filter") {
    const merged: Stage = {
      kind: "filter",
      predicate: {
        kind: "binary",
        op: "AND",
        left: lastStage.predicate,
        right: predicate,
      },
      selectAll: lastStage.selectAll,
    };
    return {
      stages: [...query.stages.slice(0, -1), merged],
      columns: query.columns,
      columnNames: query.columnNames,
    };
  }

  return appendPassthroughStage(query, {
    kind: "filter",
    predicate,
    selectAll: selectAllItems(query.columns, query.columnNames),
  });
}

export function resolveOrderQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  items: OrderItem[]
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "orderBy",
    items,
    selectAll: selectAllItems(query.columns, query.columnNames),
  });
}

export function resolveLimitQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  count: number
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "limit",
    count,
    selectAll: selectAllItems(query.columns, query.columnNames),
  });
}

export function resolveJoinQuery<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TMerged extends Record<string, any>,
>(
  leftQuery: QueryState<TLeft>,
  rightQuery: QueryState<TRight>,
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  lateral: boolean,
  joinType: JoinTypeInput,
  mergeColumns?: JoinColumnMerger<Record<string, any>, Record<string, any>, TMerged>
): QueryDeriveInit<TMerged> {
  const normalizedJoinType = normalizeJoinType(joinType);
  const alias = autoAlias(rightQuery.source.table, leftQuery.stages);
  const rightKeys = rightQuery.columnNames ? [...rightQuery.columnNames] : null;
  const rightColumns = createColumnRefs<TRight>(rightQuery.scopeId, rightKeys);
  const predicate = on(leftQuery.columns, rightColumns).node;
  const { mergedColumns, nextNames } = resolveJoinColumns(
    leftQuery.columns,
    rightColumns,
    leftQuery.columnNames,
    rightKeys,
    normalizedJoinType,
    mergeColumns
  );
  const outputScopeId = freshScopeId();
  const nextColumns = createColumnRefs<TMerged>(outputScopeId, nextNames);
  const joinSource: JoinSource =
    lateral || rightQuery.stages.length > 0
      ? {
          kind: "subquery",
          query: toQuerySpec(rightQuery),
          inheritedBindings: null,
        }
      : {
          kind: "table",
          db: rightQuery.source.db,
          table: rightQuery.source.table,
          schema: rightQuery.source.schema,
        };
  const stage: Stage = {
    kind: "join",
    joinType: normalizedJoinType,
    lateral,
    source: joinSource,
    as: alias,
    on: predicate,
    selectAll: selectAllItems(mergedColumns, nextNames),
    rightScopeId: rightQuery.scopeId,
    outputScopeId,
  };
  return {
    stages: [...leftQuery.stages, stage],
    columns: nextColumns,
    columnNames: nextNames,
    scopeId: outputScopeId,
    withs: mergeWiths(leftQuery.withs, rightQuery.withs),
    columnIdentifiers: selectItemsToIdentifierMap(stage.selectAll),
  };
}

export function resolveUnionQuery<TColumns extends Record<string, any>>(
  leftQuery: QueryState<TColumns>,
  rightQuery: QueryState<TColumns>,
  op: "union" | "union all"
): QueryDeriveInit<TColumns> {
  const leftNames = leftQuery.columnNames;
  const rightNames = rightQuery.columnNames;
  if (!leftNames || !rightNames) {
    throw new Error("union requires both queries to have explicit column lists");
  }
  assertUnionCompatible(leftNames, rightNames);
  const outputScopeId = freshScopeId();
  const stage: Stage = {
    kind: "union",
    op,
    right: toQuerySpec(rightQuery),
    selectAll: selectAllItems(leftQuery.columns, leftQuery.columnNames),
    outputScopeId,
  };
  return {
    stages: [...leftQuery.stages, stage],
    columns: createColumnRefs<TColumns>(outputScopeId, leftQuery.columnNames),
    columnNames: leftQuery.columnNames,
    scopeId: outputScopeId,
    withs: mergeWiths(leftQuery.withs, rightQuery.withs),
    columnIdentifiers: selectItemsToIdentifierMap(stage.selectAll),
  };
}

function resolveProjectedQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  stage: Extract<Stage, { kind: "select" }>
): QueryDeriveInit<Record<string, unknown>> {
  return {
    stages: [...query.stages, stage],
    columns: createColumnRefs<Record<string, unknown>>(stage.outputScopeId, stage.keys),
    columnNames: stage.keys,
    scopeId: stage.outputScopeId,
    columnIdentifiers: selectItemsToIdentifierMap(stage.items),
  };
}

function appendPassthroughStage<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  stage: Extract<Stage, { kind: "filter" | "orderBy" | "limit" }>
): QueryDeriveInit<TColumns> {
  return {
    stages: [...query.stages, stage],
    columns: query.columns,
    columnNames: query.columnNames,
  };
}
