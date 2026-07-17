import type {
  ExprNode,
  JoinSource,
  JoinType,
  OrderItem,
  QuerySpec,
  ScopeId,
  Stage,
} from "../core/types.ts";
import { isValuesSource } from "../core/types.ts";
import {
  createColumnRefs,
  dedupeExprs,
  projectAllItems,
  toExprNode,
} from "../expr.ts";
import type {
  ColumnRefs,
  Expr,
  AggregateProjectionResult,
  AggregateProjectionShape,
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
  allocateScopeId,
  resolveFoldProjection,
  resolveProjection,
} from "./planner.ts";
import { userError } from "../errors.ts";
import {
  resolveJoinColumns,
  type CanonicalJoinType,
  type JoinColumnMergerForType,
  type JoinKind,
  type JoinSelection,
  type JoinSelectionResult,
} from "./join.ts";
import type { SqlBoolean } from "../types.ts";
import type {
  QueryNameSupply,
  QueryDeriveInit,
  QueryState,
} from "./state.ts";
import { toQuerySpec } from "./state.ts";
import { mergeNameSupply } from "./name_supply.ts";
import { rebaseConflictingCtes } from "./cte_rebase.ts";

type JoinOnInput<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
> = (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => Expr<SqlBoolean | null>;

type JoinMergeInput<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
  TSelection extends JoinSelection,
> = JoinColumnMergerForType<
  TLeft,
  TRight,
  CanonicalJoinType<TType>,
  TSelection
>;

export function resolveMapQuery<
  TColumns extends Record<string, unknown>,
  TSelection extends ProjectionShape,
>(
  query: QueryState<TColumns>,
  selection: TSelection
): QueryDeriveInit<ProjectionResult<TSelection>> {
  const { keys, items } = resolveProjection(selection);
  const allocated = allocateScopeId(query);
  return resolveProjectedQuery<ProjectionResult<TSelection>>(query, {
    kind: "map",
    items,
    keys,
    groupBy: null,
    outputScopeId: allocated.scopeId,
  }, allocated.nameSupply);
}

export function resolveFoldQuery<
  TColumns extends Record<string, unknown>,
  TSelection extends AggregateProjectionShape,
>(
  query: QueryState<TColumns>,
  selection: TSelection
): QueryDeriveInit<AggregateProjectionResult<TSelection>> {
  const resolved = resolveFoldProjection(selection);
  const finalGroupBy = dedupeExprs(resolved.groupBy);
  const allocated = allocateScopeId(query);
  return resolveProjectedQuery<AggregateProjectionResult<TSelection>>(query, {
    kind: "fold",
    items: resolved.items,
    keys: resolved.keys,
    groupBy: finalGroupBy.length ? finalGroupBy : null,
    outputScopeId: allocated.scopeId,
  }, allocated.nameSupply);
}

export function resolveFilterQuery<TColumns extends Record<string, unknown>>(
  query: QueryState<TColumns>,
  predicate: ExprNode<boolean | null>
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "filter",
    predicate,
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveSortQuery<TColumns extends Record<string, unknown>>(
  query: QueryState<TColumns>,
  items: OrderItem[]
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "sort",
    items,
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveDistinctQuery<TColumns extends Record<string, unknown>>(
  query: QueryState<TColumns>
): QueryDeriveInit<TColumns> {
  return appendPassthroughStage(query, {
    kind: "distinct",
    projectAll: projectAllItems(query.columns, query.columnNames, query.columnIdentifiers),
  });
}

export function resolveTakeQuery<TColumns extends Record<string, unknown>>(
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
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
  TSelection extends JoinSelection,
>(
  leftQuery: QueryState<TLeft>,
  rightQuery: QueryState<TRight>,
  on: JoinOnInput<TLeft, TRight>,
  lateral: boolean,
  joinType: TType,
  mergeColumns?: JoinMergeInput<TLeft, TRight, TType, TSelection>
): QueryDeriveInit<JoinSelectionResult<TSelection>> {
  rightQuery = rebaseConflictingCtes(
    rightQuery,
    leftQuery.withs,
    Math.max(leftQuery.nameSupply.cte, rightQuery.nameSupply.cte)
  );
  const normalizedJoinType = normalizeJoinType(joinType);
  const alias = autoAlias(sourceAliasBase(rightQuery.source), leftQuery.stages);
  const rightKeys = [...rightQuery.columnNames];
  const allocatedRight = allocateScopeId({
    nameSupply: mergeNameSupply(leftQuery.nameSupply, rightQuery.nameSupply),
  });
  const rightScopeId = allocatedRight.scopeId;
  const rightRefs = createColumnRefs<TRight>(rightScopeId, rightKeys);
  const predicate = toExprNode(on(leftQuery.columns, rightRefs));
  const { mergedColumns, nextNames } = resolveJoinColumnsForType(
    leftQuery.columns,
    rightRefs,
    leftQuery.columnNames,
    rightKeys,
    normalizedJoinType,
    mergeColumns
  );
  const allocated = allocateScopeId({ nameSupply: allocatedRight.nameSupply });
  const outputScopeId = allocated.scopeId;
  const nextColumns = createColumnRefs<JoinSelectionResult<TSelection>>(outputScopeId, nextNames);
  const joinSource: JoinSource =
    lateral || rightQuery.stages.length > 0 || isValuesSource(rightQuery.source)
      ? {
          kind: "subquery",
          query: rewriteQuerySpecScope(toQuerySpec(rightQuery), rightQuery.scopeId, rightScopeId),
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
    rightScopeId,
    outputScopeId,
  };
  return {
    stages: [...leftQuery.stages, stage],
    columns: nextColumns,
    columnNames: nextNames,
    scopeId: outputScopeId,
    withs: mergeWiths(leftQuery.withs, rightQuery.withs),
    columnIdentifiers: projectionItemsToIdentifierMap(stage.projectAll),
    nameSupply: allocated.nameSupply,
  };
}

function resolveJoinColumnsForType<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
  TSelection extends JoinSelection,
>(
  leftRefs: ColumnRefs<TLeft>,
  rightRefs: ColumnRefs<TRight>,
  leftNames: readonly string[],
  rightNames: readonly string[],
  joinType: JoinType,
  mergeColumns?: JoinMergeInput<TLeft, TRight, TType, TSelection>
): { mergedColumns: TSelection; nextNames: readonly string[] } {
  switch (joinType) {
    case "LEFT":
      return resolveJoinColumns(
        leftRefs,
        rightRefs,
        leftNames,
        rightNames,
        joinType,
        mergeColumns as JoinColumnMergerForType<TLeft, TRight, "left", TSelection> | undefined
      );
    case "RIGHT":
      return resolveJoinColumns(
        leftRefs,
        rightRefs,
        leftNames,
        rightNames,
        joinType,
        mergeColumns as JoinColumnMergerForType<TLeft, TRight, "right", TSelection> | undefined
      );
    case "FULL":
      return resolveJoinColumns(
        leftRefs,
        rightRefs,
        leftNames,
        rightNames,
        joinType,
        mergeColumns as JoinColumnMergerForType<TLeft, TRight, "full", TSelection> | undefined
      );
    case "INNER":
      return resolveJoinColumns(
        leftRefs,
        rightRefs,
        leftNames,
        rightNames,
        joinType,
        mergeColumns as JoinColumnMergerForType<TLeft, TRight, "inner", TSelection> | undefined
      );
  }
}

export function resolveUnnestQuery<
  TLeft extends Record<string, unknown>,
  TGenerated extends Record<string, unknown>,
>(
  leftQuery: QueryState<TLeft>,
  collection: Expr<unknown>,
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

  const allocatedRight = allocateScopeId(leftQuery);
  const allocatedOutput = allocateScopeId({ nameSupply: allocatedRight.nameSupply });
  const rightScopeId = allocatedRight.scopeId;
  const outputScopeId = allocatedOutput.scopeId;
  const alias = autoAlias("unnest", leftQuery.stages);
  const generatedRefs = createColumnRefs<TGenerated>(rightScopeId, generatedKeys);
  const mergedColumns = { ...leftQuery.columns, ...generatedRefs };
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
    nameSupply: allocatedOutput.nameSupply,
  };
}

export function resolveUnionQuery<TColumns extends Record<string, unknown>>(
  leftQuery: QueryState<TColumns>,
  rightQuery: QueryState<TColumns>,
  op: "union" | "union all"
): QueryDeriveInit<TColumns> {
  rightQuery = rebaseConflictingCtes(
    rightQuery,
    leftQuery.withs,
    Math.max(leftQuery.nameSupply.cte, rightQuery.nameSupply.cte)
  );
  assertUnionCompatible(leftQuery.columnNames, rightQuery.columnNames);
  const allocated = allocateScopeId({
    nameSupply: mergeNameSupply(leftQuery.nameSupply, rightQuery.nameSupply),
  });
  const outputScopeId = allocated.scopeId;
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
    nameSupply: allocated.nameSupply,
  };
}

function resolveProjectedQuery<TSelectedColumns extends Record<string, unknown>>(
  query: QueryState<Record<string, unknown>>,
  stage: Extract<Stage, { kind: "map" | "fold" }>,
  nameSupply: QueryNameSupply
): QueryDeriveInit<TSelectedColumns> {
  return {
    stages: [...query.stages, stage],
    columns: createColumnRefs<TSelectedColumns>(stage.outputScopeId, stage.keys),
    columnNames: stage.keys,
    scopeId: stage.outputScopeId,
    columnIdentifiers: projectionItemsToIdentifierMap(stage.items),
    nameSupply,
  };
}

function appendPassthroughStage<TColumns extends Record<string, unknown>>(
  query: QueryState<TColumns>,
  stage: Extract<Stage, { kind: "filter" | "sort" | "distinct" | "take" }>
): QueryDeriveInit<TColumns> {
  return {
    stages: [...query.stages, stage],
    columns: query.columns,
    columnNames: query.columnNames,
  };
}

function rewriteQuerySpecScope(
  spec: QuerySpec,
  from: ScopeId,
  to: ScopeId
): QuerySpec {
  if (from === to) return spec;
  return {
    ...spec,
    scopeId: rewriteScopeIdValue(spec.scopeId, from, to),
    stages: spec.stages.map((stage) => rewriteStageScope(stage, from, to)),
  };
}

function rewriteStageScope(stage: Stage, from: ScopeId, to: ScopeId): Stage {
  switch (stage.kind) {
    case "map":
    case "fold":
      return {
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
        groupBy: stage.kind === "fold"
          ? stage.groupBy?.map((expr) => rewriteExprScope(expr, from, to)) ?? null
          : stage.groupBy,
        outputScopeId: rewriteScopeIdValue(stage.outputScopeId, from, to),
      } as Stage;
    case "filter":
      return {
        ...stage,
        predicate: rewriteExprScope(stage.predicate, from, to),
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
      };
    case "sort":
      return {
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
      };
    case "distinct":
    case "take":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
      };
    case "join":
      return {
        ...stage,
        source: stage.source.kind === "subquery"
          ? {
              ...stage.source,
              query: rewriteQuerySpecScope(stage.source.query, from, to),
            }
          : stage.source,
        on: rewriteExprScope(stage.on, from, to),
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
        rightScopeId: rewriteScopeIdValue(stage.rightScopeId, from, to),
        outputScopeId: rewriteScopeIdValue(stage.outputScopeId, from, to),
      };
    case "unnest":
      return {
        ...stage,
        expr: rewriteExprScope(stage.expr, from, to),
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
        rightScopeId: rewriteScopeIdValue(stage.rightScopeId, from, to),
        outputScopeId: rewriteScopeIdValue(stage.outputScopeId, from, to),
      };
    case "union":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })),
        right: rewriteQuerySpecScope(stage.right, from, to),
        outputScopeId: rewriteScopeIdValue(stage.outputScopeId, from, to),
      };
  }
}

function rewriteExprScope<T>(expr: ExprNode<T>, from: ScopeId, to: ScopeId): ExprNode<T> {
  switch (expr.kind) {
    case "column":
      return {
        ...expr,
        table: rewriteScopeIdValue(expr.table, from, to),
      } as ExprNode<T>;
    case "literal":
    case "param":
      return expr;
    case "binary":
      return {
        ...expr,
        left: rewriteExprScope(expr.left, from, to),
        right: rewriteExprScope(expr.right, from, to),
      } as ExprNode<T>;
    case "unary":
    case "group":
      return {
        ...expr,
        expr: rewriteExprScope(expr.expr, from, to),
      } as ExprNode<T>;
    case "agg":
      return {
        ...expr,
        arg: rewriteExprScope(expr.arg, from, to),
      } as ExprNode<T>;
    case "builtin":
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprScope(arg, from, to)),
      } as ExprNode<T>;
    case "list":
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteExprScope(item, from, to)),
      } as ExprNode<T>;
    case "extract":
      return {
        ...expr,
        source: rewriteExprScope(expr.source, from, to),
      } as ExprNode<T>;
    case "cast":
      return {
        ...expr,
        expr: rewriteExprScope(expr.expr, from, to),
      } as ExprNode<T>;
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprScope(arg, from, to)),
        partitionBy: expr.partitionBy?.map((item) => rewriteExprScope(item, from, to)) ?? null,
        orderBy: expr.orderBy?.map((item) => ({
          ...item,
          expr: rewriteExprScope(item.expr, from, to),
        })) ?? null,
      } as ExprNode<T>;
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: rewriteExprScope(item.when, from, to),
          then: rewriteExprScope(item.then, from, to),
        })),
        elseExpr: expr.elseExpr ? rewriteExprScope(expr.elseExpr, from, to) : null,
      } as ExprNode<T>;
  }
}

function rewriteScopeIdValue<T extends ScopeId | string | null>(
  scopeId: T,
  from: ScopeId,
  to: ScopeId
): T {
  return (scopeId === from ? to : scopeId) as T;
}
