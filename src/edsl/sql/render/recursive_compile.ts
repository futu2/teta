import type { QuerySpec } from "../../core/types";
import type { QueryDialect } from "../types";
import type { SelectAst } from "./types";
import { stageToSelect } from "./select";
import type { CompileSourceRef } from "./source";
import { buildBaseSelectAst } from "./segment";
import { optimizeLoopStages, type LoopPartLabel } from "./recursive_optimizer";
import { advanceStagePlanningState, type StagePlanningState } from "./planner";

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
    compiled = stageToSelect(
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
    throw new Error(`Internal error: loop ${label} did not compile`);
  }
  return compiled;
}
