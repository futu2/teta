import type { Stage } from "../../core/types";
import { stageOutputNames } from "./planner";
import {
  compactLoopStages,
  optimizeLoopStage,
  type LoopPartLabel,
} from "./recursive_optimizer_stage";

export type { LoopPartLabel } from "./recursive_optimizer_stage";

export function optimizeLoopStages(
  stages: Stage[],
  columnNames: readonly string[] | null,
  label: LoopPartLabel
): Stage[] {
  if (stages.length === 0) return [];

  const planned: Stage[] = new Array(stages.length);
  let needed = initialNeededColumns(stages, columnNames);

  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const optimized = optimizeLoopStage(stages[index]!, needed, label);
    planned[index] = optimized.stage;
    needed = optimized.needed;
  }

  return compactLoopStages(planned);
}

function initialNeededColumns(
  stages: Stage[],
  columnNames: readonly string[] | null
): Set<string> {
  if (columnNames) {
    return new Set<string>(columnNames);
  }

  const outputNames = stageOutputNames(stages[stages.length - 1]!);
  return outputNames ? new Set<string>(outputNames) : new Set<string>();
}
