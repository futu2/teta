import type { With } from "node-sql-parser";
import type { QueryDialect } from "../types.ts";
import type { ExprNode, ScopeId, SqlIdentifier, Stage } from "../../core/types.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { hoistJoinSubquery, type CompileSourceRef } from "./source.ts";
import { compileUnionStage } from "./union.ts";
import { mergePredicates } from "./predicate.ts";
import { nextStageColumnIdentifiers, stageOutputNames } from "./planner.ts";
import { bindFusedExpr, type ScopeExprLookup } from "./fused.ts";
import { buildFusedJoinFrom } from "./build_fused_join.ts";
import { buildFusedUnnestFrom } from "./build_fused_unnest.ts";
import { handlePostProjectionFilterStage } from "./build_fused_filter.ts";
import { internalError } from "../../errors.ts";
import type { CompiledSegment } from "./segment.ts";
import {
  applyFusedJoinStage,
  applyFusedLimitStage,
  applyFusedOrderStage,
  applyFusedProjectionStage,
  applyFusedUnnestStage,
  consumeFusedStage,
  createFusedBuildState,
  finishFusedSegment,
  finishFusedSegmentWithPredicates,
} from "./build_fused_state.ts";

export type FusedBuildOptions = {
  ctes: With[];
  ctePrefix: string;
  inheritedBindings?: ScopeBindings;
  dialect: QueryDialect;
  allowJoinSubqueryHoist?: boolean;
  allowIntermediateCtes?: boolean;
};

export function tryBuildFusedSegmentAst(
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inputColumnNames: readonly string[],
  inputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  stages: Stage[],
  options: FusedBuildOptions
): CompiledSegment | null {
  const { ctes, ctePrefix, inheritedBindings, dialect } = options;
  const allowJoinSubqueryHoist = options.allowJoinSubqueryHoist ?? true;
  const allowIntermediateCtes = options.allowIntermediateCtes ?? true;

  if (stages.length === 0) return null;
  if (stages[0]?.kind === "union") return null;

  const state = createFusedBuildState(
    source,
    sourceScopeId,
    inputColumnNames,
    inputColumnIdentifiers,
    inheritedBindings,
    dialect
  );

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const rawStage = stages[stageIndex]!;
    const stage =
      allowJoinSubqueryHoist && rawStage.kind === "join"
        ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect)
        : rawStage;

    switch (state.phase) {
      case "preprojection":
        switch (stage.kind) {
          case "filter":
            state.whereExpr = handlePreprojectionFilter(
              stage,
              state.scopeExprs,
              state.currentBindings,
              dialect,
              state.whereExpr
            );
            consumeFusedStage(state, stage);
            continue;
          case "join": {
            const nextJoin = buildFusedJoinFrom(
              stage,
              state.scopeExprs,
              state.currentBindings,
              state.baseAlias,
              ctePrefix,
              dialect,
              allowJoinSubqueryHoist,
              allowIntermediateCtes
            );
            applyFusedJoinStage(state, stage, nextJoin);
            continue;
          }
          case "unnest": {
            const nextUnnest = buildFusedUnnestFrom(
              stage,
              state.scopeExprs,
              state.currentBindings,
              dialect
            );
            applyFusedUnnestStage(state, stage, nextUnnest);
            continue;
          }
          case "map":
          case "fold":
            applyFusedProjectionStage(state, stage);
            continue;
          case "sort":
            applyFusedOrderStage(state, stage);
            continue;
          case "take":
            applyFusedLimitStage(state, stage);
            continue;
          case "union":
            return state.consumed === 0 ? null : finishFusedSegment(state, dialect);
          default:
            return assertNever(stage);
        }
      case "postprojection":
        if (stage.kind === "filter") {
          const outcome = handlePostProjectionFilterStage(
            stage,
            state.projection,
            state.scopeExprs,
            state.currentBindings,
            dialect,
            state.whereExpr,
            state.havingExpr,
            state.qualifyExpr,
            (whereExpr, havingExpr, qualifyExpr) =>
              finishFusedSegmentWithPredicates(
                state,
                dialect,
                whereExpr,
                havingExpr,
                qualifyExpr
              ),
            (outerWindow, inner) =>
              state.projection
                ? tryBuildFusedSegmentAst(
                    {
                      kind: "subquery",
                      ast: inner.ast,
                      as: null,
                      columnIdentifiers: inner.output.columnIdentifiers,
                    },
                    state.projection.outputScopeId,
                    state.projection.keys,
                    inner.output.columnIdentifiers,
                    [{ ...stage, predicate: outerWindow }, ...stages.slice(stageIndex + 1)],
                    options
                  )
                : null
          );

          if (outcome.action === "continue") {
            state.whereExpr = outcome.whereExpr;
            state.havingExpr = outcome.havingExpr;
            state.qualifyExpr = outcome.qualifyExpr;
            consumeFusedStage(state, stage);
            continue;
          }
          if (outcome.action === "return") {
            return outcome.result;
          }
          break;
        }

        if (stage.kind === "sort" && !state.orderStage) {
          applyFusedOrderStage(state, stage);
          continue;
        }
        if (stage.kind === "take" && !state.limitStage) {
          applyFusedLimitStage(state, stage);
          continue;
        }
        break;
      case "postorder":
        if (stage.kind === "take" && !state.limitStage) {
          applyFusedLimitStage(state, stage);
          continue;
        }
        break;
      case "postlimit":
        break;
      default:
        return assertNever(state.phase);
    }

    break;
  }

  if (state.consumed === 0) return null;
  return finishFusedSegment(state, dialect);
}

export function compileSingleStageAst(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  options: FusedBuildOptions
): SelectAst {
  if (stage.kind === "union") {
    return compileUnionStage(
      stage,
      source,
      sourceScopeId,
      options.ctes,
      `${options.ctePrefix}u0_`,
      options.inheritedBindings,
      options.dialect
    );
  }

  const compiled = tryBuildFusedSegmentAst(
    source,
    sourceScopeId,
    stageOutputNames(stage),
    nextStageColumnIdentifiers(stage, source.columnIdentifiers),
    [stage],
    options
  );
  if (!compiled) {
    internalError("INTERNAL_STAGE_COMPILE_FAILED", `Internal error: failed to compile stage ${stage.kind}`);
  }
  return compiled.ast;
}

function handlePreprojectionFilter(
  stage: Extract<Stage, { kind: "filter" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  dialect: QueryDialect,
  whereExpr: ExprNode<unknown> | null
): ExprNode<unknown> {
  return mergePredicates(
    whereExpr,
    bindFusedExpr(stage.predicate, scopeExprs, currentBindings, dialect)
  );
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
