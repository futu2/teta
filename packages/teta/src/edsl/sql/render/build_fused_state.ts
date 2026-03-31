import type { QueryDialect } from "../types.ts";
import type {
  ExprNode,
  ScopeId,
  SqlIdentifier,
  Stage,
} from "../../core/types.ts";
import { projectionItemsToIdentifierMap } from "../../query/utils.ts";
import type { FromAst, ScopeBindings } from "./types.ts";
import { ensureAlias } from "./ast.ts";
import { getSqlRenderContext } from "./render.ts";
import type { CompileSourceRef } from "./source.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import { nextStageColumnIdentifiers, nextStageColumnNames } from "./planner.ts";
import {
  projectionItemsToScopeMap,
  type ScopeExprLookup,
} from "./fused.ts";
import type { FusedJoinFrom } from "./build_fused_join.ts";
import type { FusedUnnestFrom } from "./build_fused_unnest.ts";
import {
  buildBaseFrom,
  buildCompiledSegment,
  type CompiledSegment,
} from "./segment.ts";

export type FusedBuildPhase =
  | "preprojection"
  | "postprojection"
  | "postorder"
  | "postlimit";

export type FusedBuildState = {
  baseAlias: string;
  from: FromAst[];
  scopeExprs: ScopeExprLookup;
  currentBindings: ScopeBindings;
  currentScopeId: ScopeId;
  currentColumnNames: readonly string[];
  currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  projection: Extract<Stage, { kind: "map" | "fold" }> | null;
  orderStage: Extract<Stage, { kind: "sort" }> | null;
  limitStage: Extract<Stage, { kind: "take" }> | null;
  whereExpr: ExprNode<unknown> | null;
  havingExpr: ExprNode<unknown> | null;
  qualifyExpr: ExprNode<unknown> | null;
  phase: FusedBuildPhase;
  consumed: number;
};

export function createFusedBuildState(
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inputColumnNames: readonly string[],
  _inputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect
): FusedBuildState {
  const baseFrom = buildBaseFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
  const currentBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };

  return {
    baseAlias,
    from: [baseFrom],
    scopeExprs: {},
    currentBindings,
    currentScopeId: sourceScopeId,
    currentColumnNames: inputColumnNames,
    currentColumnIdentifiers: source.columnIdentifiers,
    projection: null,
    orderStage: null,
    limitStage: null,
    whereExpr: null,
    havingExpr: null,
    qualifyExpr: null,
    phase: "preprojection",
    consumed: 0,
  };
}

export function consumeFusedStage(state: FusedBuildState, stage: Stage): void {
  state.currentColumnNames = nextStageColumnNames(stage, state.currentColumnNames);
  state.currentColumnIdentifiers = nextStageColumnIdentifiers(
    stage,
    state.currentColumnIdentifiers
  );
  state.consumed += 1;
}

export function applyFusedJoinStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "join" }>,
  nextJoin: FusedJoinFrom
): void {
  state.from.push(nextJoin.from);
  state.currentBindings = nextJoin.bindings;
  state.scopeExprs[stage.outputScopeId] = projectionItemsToScopeMap(stage.projectAll);
  state.currentScopeId = stage.outputScopeId;
  consumeFusedStage(state, stage);
}

export function applyFusedUnnestStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "unnest" }>,
  nextUnnest: FusedUnnestFrom
): void {
  state.from.push(nextUnnest.from);
  state.currentBindings = nextUnnest.bindings;
  state.scopeExprs[stage.outputScopeId] = projectionItemsToScopeMap(stage.projectAll);
  state.currentScopeId = stage.outputScopeId;
  consumeFusedStage(state, stage);
}

export function applyFusedProjectionStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "map" | "fold" }>
): void {
  state.projection = stage;
  state.scopeExprs[stage.outputScopeId] = projectionItemsToScopeMap(stage.items);
  state.currentScopeId = stage.outputScopeId;
  state.currentColumnNames = stage.keys;
  state.currentColumnIdentifiers = projectionItemsToIdentifierMap(stage.items);
  state.phase = "postprojection";
  state.consumed += 1;
}

export function applyFusedOrderStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "sort" }>
): void {
  state.orderStage = stage;
  state.phase = "postorder";
  consumeFusedStage(state, stage);
}

export function applyFusedLimitStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "take" }>
): void {
  state.limitStage = stage;
  state.phase = "postlimit";
  consumeFusedStage(state, stage);
}

export function finishFusedSegmentWithPredicates(
  state: FusedBuildState,
  dialect: QueryDialect,
  whereExpr: ExprNode<unknown> | null,
  havingExpr: ExprNode<unknown> | null,
  qualifyExpr: ExprNode<unknown> | null,
  consumedCount = state.consumed
): CompiledSegment {
  return buildCompiledSegment(
    state.from,
    state.projection,
    state.orderStage,
    state.limitStage,
    whereExpr,
    havingExpr,
    qualifyExpr,
    state.scopeExprs,
    state.currentBindings,
    state.currentScopeId,
    state.currentColumnNames,
    state.currentColumnIdentifiers,
    dialect,
    consumedCount
  );
}

export function finishFusedSegment(
  state: FusedBuildState,
  dialect: QueryDialect,
  consumedCount = state.consumed
): CompiledSegment {
  return finishFusedSegmentWithPredicates(
    state,
    dialect,
    state.whereExpr,
    state.havingExpr,
    state.qualifyExpr,
    consumedCount
  );
}
