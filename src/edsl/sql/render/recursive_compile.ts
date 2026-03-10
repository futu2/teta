import type { QuerySpec } from "../../core/types.ts";
import type { QueryDialect } from "../types.ts";
import type { SelectAst } from "./types.ts";
import { compileStageAst } from "./stage.ts";
import type { CompileSourceRef } from "./source.ts";
import { buildBaseSelectAst } from "./segment.ts";
import { optimizeLoopStages, type LoopPartLabel } from "./recursive_optimizer.ts";
import { advanceStagePlanningState, type StagePlanningState } from "./planner.ts";
import { internalError } from "../../errors.ts";

export function compileLoopPart(
  input: QuerySpec,
  label: LoopPartLabel,
  dialect: QueryDialect
): SelectAst {
  const { source, stages, columnNames, columnIdentifiers, scopeId } = input;
  if (stages.length === 0) {
    return buildBaseSelectAst(source, columnNames, scopeId, undefined, dialect);
  }

  const optimizedStages = optimizeLoopStages(stages, columnNames, label);
  if (optimizedStages.length === 0) {
    return buildBaseSelectAst(source, columnNames, scopeId, undefined, dialect);
  }

  let current: CompileSourceRef = {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers,
  };
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
      `loop_${label}_${index}_`
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
