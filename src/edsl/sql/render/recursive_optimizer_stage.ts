import type { SelectItem, Stage } from "../../core/types";
import { selectItemOutputName } from "../../query/utils";
import { stageOutputNames } from "./planner";
import { collectExprColumns } from "./recursive_optimizer_expr";

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
    case "select": {
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
      const selectAll = pruneSelectItems(stage.selectAll, needed);
      const before = new Set<string>(needed);
      collectExprColumns(stage.predicate, before);
      return {
        stage:
          selectAll === stage.selectAll
            ? stage
            : {
                ...stage,
                selectAll,
              },
        needed: before,
      };
    }
    case "join": {
      const selectAll = pruneSelectItems(stage.selectAll, needed);
      const before = new Set<string>();
      selectAll.forEach((item) =>
        collectExprColumns(item.expr, before, { excludeTable: stage.as })
      );
      collectExprColumns(stage.on, before, { excludeTable: stage.as });
      return {
        stage:
          selectAll === stage.selectAll
            ? stage
            : {
                ...stage,
                selectAll,
              },
        needed: before.size ? before : new Set<string>(needed),
      };
    }
    case "orderBy":
    case "limit":
    case "union":
      throw new Error(`loop ${label} does not allow ${stage.kind} stages`);
    default:
      return assertNever(stage);
  }
}

export function compactLoopStages(
  stages: Stage[],
  inputNames: readonly string[]
): Stage[] {
  return mergeAdjacentLoopFilters(removeNoOpLoopSelects(stages, inputNames));
}

function validateLoopStage(stage: Stage, label: LoopPartLabel): void {
  switch (stage.kind) {
    case "orderBy":
    case "limit":
    case "union":
      throw new Error(`loop ${label} does not allow ${stage.kind} stages`);
    default:
      break;
  }
}

function mergeAdjacentLoopFilters(stages: Stage[]): Stage[] {
  if (stages.length < 2) return stages;
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
        selectAll: stage.selectAll,
      };
      continue;
    }
    merged.push(stage);
  }
  return merged;
}

function pruneSelectItems(
  items: SelectItem[],
  needed: ReadonlySet<string>
): SelectItem[] {
  const pruned = items.filter((item) => {
    const name = selectItemOutputName(item);
    if (!name) return true;
    return needed.has(name);
  });
  if (pruned.length === 0 || pruned.length === items.length) return items;
  return pruned;
}

function removeNoOpLoopSelects(
  stages: Stage[],
  initialInputNames: readonly string[]
): Stage[] {
  const compact: Stage[] = [];
  let inputNames = initialInputNames;
  for (const stage of stages) {
    if (stage.kind === "select" && isNoOpLoopSelect(stage, inputNames)) {
      continue;
    }
    compact.push(stage);
    inputNames = stageOutputNames(stage);
  }
  return compact;
}

function isNoOpLoopSelect(
  stage: Extract<Stage, { kind: "select" }>,
  inputNames: readonly string[]
): boolean {
  if (stage.groupBy && stage.groupBy.length > 0) return false;
  if (inputNames.length !== stage.keys.length) return false;
  for (let index = 0; index < stage.keys.length; index += 1) {
    const key = stage.keys[index]!;
    const input = inputNames[index]!;
    const item = stage.items[index];
    if (!item) return false;
    if (key !== input) return false;
    if (item.as && selectItemOutputName(item) !== key) return false;
    if (item.expr.kind !== "column") return false;
    if (item.expr.table !== null) return false;
    if (item.expr.name !== key) return false;
  }
  return true;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
