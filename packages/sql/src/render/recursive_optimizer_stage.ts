import type { ProjectionItem, Stage } from "../ir/types.ts";
import { projectionItemOutputName } from "../ir/utils.ts";
import { internalError, userError } from "../errors.ts";
import { stageOutputNames } from "./planner.ts";
import { collectExprColumns } from "./recursive_optimizer_expr.ts";

export type LoopPartLabel = "base" | "step";

export type OptimizeLoopStageResult = {
  stage: Stage;
  needed: Set<string>;
};

export function optimizeLoopStage(
  stage: Stage,
  needed: ReadonlySet<string>,
  label: LoopPartLabel
): OptimizeLoopStageResult {
  validateLoopStage(stage, label);

  switch (stage.kind) {
    case "map":
    case "fold": {
      const keptIndexes = stage.keys
        .map((key, itemIndex) => ({ key, itemIndex }))
        .filter(({ key }) => needed.has(key))
        .map(({ itemIndex }) => itemIndex);
      const useAll = keptIndexes.length === 0;
      const items = useAll
        ? stage.items
        : keptIndexes.map((itemIndex) => stage.items[itemIndex]!);
      const keys = useAll
        ? stage.keys
        : keptIndexes.map((itemIndex) => stage.keys[itemIndex]!);
      const before = new Set<string>();
      items.forEach((item) => collectExprColumns(item.expr, before));
      stage.groupBy?.forEach((expr) => collectExprColumns(expr, before));
      return {
        stage:
          items.length === stage.items.length
            ? stage
            : {
                ...stage,
                items,
                keys,
              },
        needed: before,
      };
    }
    case "filter": {
      const projectAll = pruneProjectionItems(stage.projectAll, needed);
      const before = new Set<string>(needed);
      collectExprColumns(stage.predicate, before);
      return {
        stage:
          projectAll === stage.projectAll
            ? stage
            : {
                ...stage,
                projectAll,
              },
        needed: before,
      };
    }
    case "join": {
      const projectAll = pruneProjectionItems(stage.projectAll, needed);
      const before = new Set<string>();
      projectAll.forEach((item) =>
        collectExprColumns(item.expr, before, { excludeTable: stage.as })
      );
      collectExprColumns(stage.on, before, { excludeTable: stage.as });
      return {
        stage:
          projectAll === stage.projectAll
            ? stage
            : {
                ...stage,
                projectAll,
              },
        needed: before.size ? before : new Set<string>(needed),
      };
    }
    case "sort":
    case "take":
    case "unnest":
    case "union":
      userError("LOOP_UNSUPPORTED_STAGE", `loop ${label} does not allow ${stage.kind} stages`);
    default:
      return assertNever(stage);
  }
}

export function compactLoopStages(
  stages: readonly Stage[],
  inputNames: readonly string[]
): Stage[] {
  return mergeAdjacentLoopFilters(removeNoOpLoopMaps(stages, inputNames));
}

function validateLoopStage(stage: Stage, label: LoopPartLabel): void {
  switch (stage.kind) {
    case "sort":
    case "take":
    case "unnest":
    case "union":
      userError("LOOP_UNSUPPORTED_STAGE", `loop ${label} does not allow ${stage.kind} stages`);
    default:
      break;
  }
}

function mergeAdjacentLoopFilters(stages: readonly Stage[]): Stage[] {
  if (stages.length < 2) return [...stages];
  const merged: Stage[] = [];
  for (const stage of stages) {
    const previous = merged[merged.length - 1];
    if (stage.kind === "filter" && previous?.kind === "filter") {
      merged[merged.length - 1] = {
        kind: "filter",
        predicate: {
          kind: "binary",
          op: "AND",
          left: previous.predicate,
          right: stage.predicate,
        },
        projectAll: stage.projectAll,
      };
      continue;
    }
    merged.push(stage);
  }
  return merged;
}

function pruneProjectionItems(
  items: readonly ProjectionItem[],
  needed: ReadonlySet<string>
): ProjectionItem[] {
  const pruned = items.filter((item) => {
    const name = projectionItemOutputName(item);
    if (!name) return true;
    return needed.has(name);
  });
  if (pruned.length === 0 || pruned.length === items.length) return [...items];
  return pruned;
}

function removeNoOpLoopMaps(
  stages: readonly Stage[],
  initialInputNames: readonly string[]
): Stage[] {
  const compact: Stage[] = [];
  let inputNames = initialInputNames;
  for (const stage of stages) {
    if (stage.kind === "map" && isNoOpLoopMap(stage, inputNames)) {
      continue;
    }
    compact.push(stage);
    inputNames = stageOutputNames(stage);
  }
  return compact;
}

function isNoOpLoopMap(
  stage: Extract<Stage, { kind: "map" }>,
  inputNames: readonly string[]
): boolean {
  if (inputNames.length !== stage.keys.length) return false;
  for (let index = 0; index < stage.keys.length; index += 1) {
    const key = stage.keys[index]!;
    const input = inputNames[index]!;
    const item = stage.items[index];
    if (!item) return false;
    if (key !== input) return false;
    if (item.as && projectionItemOutputName(item) !== key) return false;
    if (item.expr.kind !== "column") return false;
    if (item.expr.table !== null) return false;
    if (item.expr.name !== key) return false;
  }
  return true;
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
