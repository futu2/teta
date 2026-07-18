import type { LogicalStage } from "./logical.ts";
import type { QueryDeriveInit, QueryState } from "./state.ts";

export function normalizeQueryState<TColumns extends Record<string, unknown>>(
  state: QueryState<TColumns>
): QueryState<TColumns> {
  return {
    ...state,
    stages: normalizeStages(state.stages),
  };
}

export function normalizeDerivedQueryInit<TColumns extends Record<string, unknown>>(
  init: QueryDeriveInit<TColumns>
): QueryDeriveInit<TColumns> {
  return {
    ...init,
    stages: normalizeStages(init.stages),
  };
}

export function normalizeStages(stages: readonly LogicalStage[]): readonly LogicalStage[] {
  return normalizeAdjacentStages(stages);
}

function normalizeAdjacentStages(stages: readonly LogicalStage[]): readonly LogicalStage[] {
  const normalized: LogicalStage[] = [];

  for (const stage of stages) {
    const previous = normalized[normalized.length - 1];
    if (previous?.kind === "filter" && stage.kind === "filter") {
      normalized[normalized.length - 1] = {
        kind: "filter",
        predicate: {
          kind: "binary",
          op: "AND",
          left: previous.predicate,
          right: stage.predicate,
        },
      };
      continue;
    }
    if (previous?.kind === "distinct" && stage.kind === "distinct") {
      continue;
    }

    normalized.push(stage);
  }

  return normalized.length === stages.length ? stages : normalized;
}
