import type {
  ExprNode,
  JoinSource,
  JoinTypeInput,
  OrderItem,
  Stage,
} from "../core/types.ts";
import { isValuesSource } from "../core/types.ts";
import {
  createColumnRefs,
  dedupeExprs,
  projectAllItems,
} from "../expr.ts";
import type {
  ColumnRefs,
  ExprRef,
  ProjectionResult,
  ProjectionShape,
} from "../expr.ts";
import {
  autoAlias,
  assertUnionCompatible,
  columnNamesToIdentifierMap,
  mergeWiths,
  normalizeJoinType,
  projectionItemsToIdentifierMap,
  sourceAliasBase,
} from "./utils.ts";
import {
  freshScopeId,
  resolveFoldProjection,
  resolveProjection,
} from "./planner.ts";
import { userError } from "../errors.ts";
import {
  resolveJoinColumns,
  type JoinColumnMerger,
  type JoinSelection,
  type JoinSelectionResult,
} from "./join.ts";
import type {
  QueryDeriveInit,
  QueryState,
} from "./state.ts";
import { toQuerySpec } from "./state.ts";

export function resolveMapQuery<
  TColumns extends Record<string, any>,
  TSelection extends ProjectionShape,
>(
  query: QueryState<TColumns>,
  selection: TSelection
): QueryDeriveInit<ProjectionResult<TSelection>> {
  const { keys, items } = resolveProjection(selection);
  return resolveProjectedQuery<ProjectionResult<TSelection>>(query, {
    kind: "map",
    items,
    keys,
    groupBy: null,
    outputScopeId: freshScopeId(),
  });
}

export function resolveFoldQuery<
  TColumns extends Record<string, any>,
  TSelection extends ProjectionShape,
>(
  query: QueryState<TColumns>,
  selection: TSelection
): QueryDeriveInit<ProjectionResult<TSelection>> {
  const resolved = resolveFoldProjection(selection);
  const finalGroupBy = dedupeExprs(resolved.groupBy);
  return resolveProjectedQuery<ProjectionResult<TSelection>>(query, {
    kind: "fold",
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
      projectAll: lastStage.projectAll,
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
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveSortQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  items: OrderItem[]
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "sort",
    items,
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveTakeQuery<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  count: number
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "take",
    count,
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveJoinQuery<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TSelection extends JoinSelection,
>(
  leftQuery: QueryState<TLeft>,
  rightQuery: QueryState<TRight>,
  on: (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
  lateral: boolean,
  joinType: JoinTypeInput,
  mergeColumns?: JoinColumnMerger<Record<string, any>, Record<string, any>, TSelection>
): QueryDeriveInit<JoinSelectionResult<TSelection>> {
  const normalizedJoinType = normalizeJoinType(joinType);
  const alias = autoAlias(sourceAliasBase(rightQuery.source), leftQuery.stages);
  const rightKeys = [...rightQuery.columnNames];
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
  const nextColumns = createColumnRefs<JoinSelectionResult<TSelection>>(outputScopeId, nextNames);
  const joinSource: JoinSource =
    lateral || rightQuery.stages.length > 0 || isValuesSource(rightQuery.source)
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
          columnIdentifiers: rightQuery.columnIdentifiers,
        };
  const stage: Stage = {
    kind: "join",
    joinType: normalizedJoinType,
    lateral,
    source: joinSource,
    as: alias,
    on: predicate,
    projectAll: projectAllItems(mergedColumns, nextNames),
    rightScopeId: rightQuery.scopeId,
    outputScopeId,
  };
  return {
    stages: [...leftQuery.stages, stage],
    columns: nextColumns,
    columnNames: nextNames,
    scopeId: outputScopeId,
    withs: mergeWiths(leftQuery.withs, rightQuery.withs),
    columnIdentifiers: projectionItemsToIdentifierMap(stage.projectAll),
  };
}

export function resolveUnnestQuery<
  TLeft extends Record<string, any>,
  TGenerated extends Record<string, any>,
>(
  leftQuery: QueryState<TLeft>,
  collection: ExprRef<unknown>,
  selection: { value: string; ordinality?: string },
  options: { outer?: boolean } = {}
): QueryDeriveInit<TLeft & TGenerated> {
  const generatedKeys = selection.ordinality
    ? [selection.value, selection.ordinality]
    : [selection.value];

  for (const key of generatedKeys) {
    if (leftQuery.columnNames.includes(key)) {
      userError("UNNEST_COLUMN_CONFLICT", `unnest column already exists: ${key}`);
    }
  }

  const rightScopeId = freshScopeId();
  const outputScopeId = freshScopeId();
  const alias = autoAlias("unnest", leftQuery.stages);
  const rightColumns = createColumnRefs<TGenerated>(rightScopeId, generatedKeys);
  const mergedColumns = { ...leftQuery.columns, ...rightColumns };
  const nextNames = [...leftQuery.columnNames, ...generatedKeys];
  const generatedIdentifiers = columnNamesToIdentifierMap(generatedKeys);
  const stage: Stage = {
    kind: "unnest",
    mode: options.outer ? "outer" : "inner",
    expr: collection.node,
    withOrdinality: selection.ordinality !== undefined,
    as: alias,
    columnNames: generatedKeys,
    columnIdentifiers: generatedIdentifiers,
    projectAll: projectAllItems(
      mergedColumns,
      nextNames,
      { ...leftQuery.columnIdentifiers, ...generatedIdentifiers }
    ),
    rightScopeId,
    outputScopeId,
  };

  return {
    stages: [...leftQuery.stages, stage],
    columns: createColumnRefs<TLeft & TGenerated>(outputScopeId, nextNames),
    columnNames: nextNames,
    scopeId: outputScopeId,
    withs: leftQuery.withs,
    columnIdentifiers: projectionItemsToIdentifierMap(stage.projectAll),
  };
}

export function resolveUnionQuery<TColumns extends Record<string, any>>(
  leftQuery: QueryState<TColumns>,
  rightQuery: QueryState<TColumns>,
  op: "union" | "union all"
): QueryDeriveInit<TColumns> {
  assertUnionCompatible(leftQuery.columnNames, rightQuery.columnNames);
  const outputScopeId = freshScopeId();
  const stage: Stage = {
    kind: "union",
    op,
    right: toQuerySpec(rightQuery),
    projectAll: projectAllItems(leftQuery.columns, leftQuery.columnNames, leftQuery.columnIdentifiers),
    outputScopeId,
  };
  return {
    stages: [...leftQuery.stages, stage],
    columns: createColumnRefs<TColumns>(outputScopeId, leftQuery.columnNames),
    columnNames: leftQuery.columnNames,
    scopeId: outputScopeId,
    withs: mergeWiths(leftQuery.withs, rightQuery.withs),
    columnIdentifiers: projectionItemsToIdentifierMap(stage.projectAll),
  };
}

function resolveProjectedQuery<TSelectedColumns extends Record<string, any>>(
  query: QueryState<Record<string, any>>,
  stage: Extract<Stage, { kind: "map" | "fold" }>
): QueryDeriveInit<TSelectedColumns> {
  return {
    stages: [...query.stages, stage],
    columns: createColumnRefs<TSelectedColumns>(stage.outputScopeId, stage.keys),
    columnNames: stage.keys,
    scopeId: stage.outputScopeId,
    columnIdentifiers: projectionItemsToIdentifierMap(stage.items),
  };
}

function appendPassthroughStage<TColumns extends Record<string, any>>(
  query: QueryState<TColumns>,
  stage: Extract<Stage, { kind: "filter" | "sort" | "take" }>
): QueryDeriveInit<TColumns> {
  return {
    stages: [...query.stages, stage],
    columns: query.columns,
    columnNames: query.columnNames,
  };
}
