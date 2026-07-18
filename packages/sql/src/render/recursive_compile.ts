import type { With } from "node-sql-parser";
import type { QuerySpec } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { SelectAst, SqlRenderContext } from "./types.ts";
import { compileStageAst } from "./stage.ts";
import { compileSourceRef, type CompileSourceRef } from "./source.ts";
import { buildBaseSelectAst } from "./segment.ts";
import { optimizeLoopStages, type LoopPartLabel } from "./recursive_optimizer.ts";
import { advanceStagePlanningState, type StagePlanningState } from "./planner.ts";
import { internalError } from "../errors.ts";
import { tryBuildFusedSegmentAst } from "./build_fused.ts";

export function compileLoopPart(
  input: QuerySpec,
  label: LoopPartLabel,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): SelectAst {
  const { source, stages, columnNames, columnIdentifiers, scopeId } = input;
  const baseSource = compileSourceRef(source, columnIdentifiers, dialect, renderContext);
  const fusedCtes: With[] = [];
  if (stages.length === 0) {
    return buildBaseSelectAst(baseSource, columnNames, scopeId, undefined, dialect, renderContext);
  }

  const optimizedStages = optimizeLoopStages(stages, columnNames, label);
  if (optimizedStages.length === 0) {
    return buildBaseSelectAst(baseSource, columnNames, scopeId, undefined, dialect, renderContext);
  }

  const fused = tryBuildFusedSegmentAst(
    baseSource,
    scopeId,
    columnNames,
    columnIdentifiers,
    optimizedStages,
    {
      ctes: fusedCtes,
      ctePrefix: `loop_${label}_`,
      dialect,
      allowJoinSubqueryHoist: false,
      allowIntermediateCtes: false,
      renderContext,
    }
  );
  if (fused && fused.consumed === optimizedStages.length && fusedCtes.length === 0) {
    return fused.ast;
  }

  let current: CompileSourceRef = baseSource;
  let currentPlan: StagePlanningState = {
    scopeId,
    columnNames,
    columnIdentifiers,
  };
  let compiled: SelectAst | null = null;

  for (let index = 0; index < optimizedStages.length; index += 1) {
    const stage = optimizedStages[index]!;
    compiled = compileStageAst(
      stage,
      current,
      currentPlan.scopeId,
      undefined,
      dialect,
      `loop_${label}_${index}_`,
      false,
      false,
      renderContext
    );
    if (index < optimizedStages.length - 1) {
      const nextPlan = advanceStagePlanningState(stage, currentPlan);
      current = {
        kind: "subquery",
        ast: compiled,
        as: `loop_${label}_${index}`,
        columnIdentifiers: nextPlan.columnIdentifiers,
      };
      currentPlan = nextPlan;
    }
  }

  if (!compiled) {
    internalError("INTERNAL_LOOP_COMPILE_FAILED", `Internal error: loop ${label} did not compile`);
  }
  return compiled;
}
