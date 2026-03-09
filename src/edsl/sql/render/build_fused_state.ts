import type { QueryDialect } from "../types";
import type {
  ExprNode,
  ScopeId,
  SqlIdentifier,
  Stage,
} from "../../core/types";
import { selectItemsToIdentifierMap } from "../../query/utils";
import type { FromAst, ScopeBindings } from "./types";
import { ensureAlias } from "./ast";
import { getSqlRenderContext } from "./render";
import type { CompileSourceRef } from "./source";
import { registerColumnIdentifierBindings } from "./identifiers";
import { nextStageColumnIdentifiers, nextStageColumnNames } from "./planner";
import {
  selectItemsToScopeMap,
  type ScopeExprLookup,
} from "./fused";
import type { FusedJoinFrom } from "./build_fused_join";
import {
  buildBaseFrom,
  buildCompiledSegment,
  type CompiledSegment,
} from "./segment";

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
  projection: Extract<Stage, { kind: "select" }> | null;
  orderStage: Extract<Stage, { kind: "orderBy" }> | null;
  limitStage: Extract<Stage, { kind: "limit" }> | null;
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
  state.scopeExprs[stage.outputScopeId] = selectItemsToScopeMap(stage.selectAll);
  state.currentScopeId = stage.outputScopeId;
  consumeFusedStage(state, stage);
}

export function applyFusedProjectionStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "select" }>
): void {
  state.projection = stage;
  state.scopeExprs[stage.outputScopeId] = selectItemsToScopeMap(stage.items);
  state.currentScopeId = stage.outputScopeId;
  state.currentColumnNames = stage.keys;
  state.currentColumnIdentifiers = selectItemsToIdentifierMap(stage.items);
  state.phase = "postprojection";
  state.consumed += 1;
}

export function applyFusedOrderStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "orderBy" }>
): void {
  state.orderStage = stage;
  state.phase = "postorder";
  consumeFusedStage(state, stage);
}

export function applyFusedLimitStage(
  state: FusedBuildState,
  stage: Extract<Stage, { kind: "limit" }>
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
