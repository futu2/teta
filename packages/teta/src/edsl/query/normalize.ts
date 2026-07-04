import type { Stage } from "../core/types.ts";
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

function normalizeStages(stages: readonly Stage[]): readonly Stage[] {
  return mergeAdjacentFilters(stages);
}

function mergeAdjacentFilters(stages: readonly Stage[]): readonly Stage[] {
  const normalized: Stage[] = [];

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
        projectAll: previous.projectAll,
      };
      continue;
    }

    normalized.push(stage);
  }

  return normalized.length === stages.length ? stages : normalized;
}
