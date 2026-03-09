import type { ScopeId, SelectItem, SqlIdentifier, Stage } from "../../core/types";
import { selectItemOutputName, selectItemsToIdentifierMap } from "../../query/utils";

export type StagePlanningState = {
  scopeId: ScopeId;
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
};

export function advanceStagePlanningState(
  stage: Stage,
  current: StagePlanningState
): StagePlanningState {
  return {
    scopeId: nextStageScopeId(stage, current.scopeId),
    columnNames: nextStageColumnNames(stage, current.columnNames),
    columnIdentifiers: nextStageColumnIdentifiers(stage, current.columnIdentifiers),
  };
}

export function nextStageScopeId(stage: Stage, currentScopeId: ScopeId): ScopeId {
  switch (stage.kind) {
    case "select":
    case "join":
    case "union":
      return stage.outputScopeId;
    case "filter":
    case "orderBy":
    case "limit":
      return currentScopeId;
    default:
      return assertNever(stage);
  }
}

export function nextStageColumnNames(
  stage: Stage,
  _currentColumnNames: readonly string[]
): readonly string[] {
  return stageOutputNames(stage);
}

export function nextStageColumnIdentifiers(
  stage: Stage,
  _currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>
): Readonly<Record<string, SqlIdentifier>> {
  switch (stage.kind) {
    case "select":
      return selectItemsToIdentifierMap(stage.items);
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
    case "union":
      return selectItemsToIdentifierMap(stage.selectAll);
    default:
      return assertNever(stage);
  }
}

export function stageOutputNames(stage: Stage): readonly string[] {
  switch (stage.kind) {
    case "select":
      return stage.keys;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
    case "union":
      return selectItemNames(stage.selectAll);
    default:
      return assertNever(stage);
  }
}

function selectItemNames(items: SelectItem[]): string[] {
  return items.map((item) => {
    const name = selectItemOutputName(item);
    if (!name) {
      throw new Error("Internal error: stage select item is missing an output name");
    }
    return name;
  });
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
