import type { Stage } from "../ir/types.ts";
import {
  compactLoopStages,
  optimizeLoopStage,
  type LoopPartLabel,
} from "./recursive_optimizer_stage.ts";

export type { LoopPartLabel } from "./recursive_optimizer_stage.ts";

export function optimizeLoopStages(
  stages: Stage[],
  columnNames: readonly string[],
  label: LoopPartLabel
): Stage[] {
  if (stages.length === 0) return [];

  const planned: Stage[] = new Array(stages.length);
  let needed = new Set<string>(columnNames);

  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const optimized = optimizeLoopStage(stages[index]!, needed, label);
    planned[index] = optimized.stage;
    needed = optimized.needed;
  }

  return compactLoopStages(planned, columnNames);
}
