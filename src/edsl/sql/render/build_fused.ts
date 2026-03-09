import type { With } from "node-sql-parser";
import type { QueryDialect } from "../types";
import type { ExprNode, SqlIdentifier, Stage } from "../../core/types";
import type { ScopeBindings, SelectAst } from "./types";
import { hoistJoinSubquery, type CompileSourceRef } from "./source";
import { compileUnionStage } from "./union";
import { mergePredicates } from "./predicate";
import { nextStageColumnIdentifiers, nextStageColumnNames } from "./planner";
import { bindFusedExpr, type ScopeExprLookup } from "./fused";
import { buildFusedJoinFrom } from "./build_fused_join";
import { handlePostProjectionFilterStage } from "./build_fused_filter";
import type { CompiledSegment } from "./segment";
import {
  applyFusedJoinStage,
  applyFusedLimitStage,
  applyFusedOrderStage,
  applyFusedProjectionStage,
  consumeFusedStage,
  createFusedBuildState,
  finishFusedSegment,
  finishFusedSegmentWithPredicates,
} from "./build_fused_state";

export type FusedBuildOptions = {
  ctes: With[];
  ctePrefix: string;
  inheritedBindings?: ScopeBindings;
  dialect: QueryDialect;
};

export function tryBuildFusedSegmentAst(
  source: CompileSourceRef,
  sourceScopeId: string,
  inputColumnNames: readonly string[] | null,
  inputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null,
  stages: Stage[],
  options: FusedBuildOptions
): CompiledSegment | null {
  const { ctes, ctePrefix, inheritedBindings, dialect } = options;

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
      rawStage.kind === "join"
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
              dialect
            );
            applyFusedJoinStage(state, stage, nextJoin);
            continue;
          }
          case "select":
            applyFusedProjectionStage(state, stage);
            continue;
          case "orderBy":
            applyFusedOrderStage(state, stage);
            continue;
          case "limit":
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

        if (stage.kind === "orderBy" && !state.orderStage) {
          applyFusedOrderStage(state, stage);
          continue;
        }
        if (stage.kind === "limit" && !state.limitStage) {
          applyFusedLimitStage(state, stage);
          continue;
        }
        break;
      case "postorder":
        if (stage.kind === "limit" && !state.limitStage) {
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
  sourceScopeId: string,
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
    nextStageColumnNames(stage, null),
    nextStageColumnIdentifiers(stage, source.columnIdentifiers ?? null),
    [stage],
    options
  );
  if (!compiled) {
    throw new Error(`Internal error: failed to compile stage ${stage.kind}`);
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
  throw new Error(`Unexpected value: ${String(value)}`);
}
