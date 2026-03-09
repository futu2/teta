import type { SelectItem, SqlIdentifier, Stage } from "../../core/types";
import { selectItemOutputName, selectItemsToIdentifierMap } from "../../query/utils";

export type StagePlanningState = {
  scopeId: string;
  columnNames: readonly string[] | null;
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null;
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

export function nextStageScopeId(stage: Stage, currentScopeId: string): string {
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
  currentColumnNames: readonly string[] | null
): readonly string[] | null {
  switch (stage.kind) {
    case "union":
      return currentColumnNames;
    default:
      return stageOutputNames(stage) ?? currentColumnNames;
  }
}

export function nextStageColumnIdentifiers(
  stage: Stage,
  currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null
): Readonly<Record<string, SqlIdentifier>> | null {
  switch (stage.kind) {
    case "union":
      return currentColumnIdentifiers;
    case "select":
      return selectItemsToIdentifierMap(stage.items) ?? currentColumnIdentifiers;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
      return selectItemsToIdentifierMap(stage.selectAll) ?? currentColumnIdentifiers;
    default:
      return assertNever(stage);
  }
}

export function stageOutputNames(stage: Stage): readonly string[] | null {
  switch (stage.kind) {
    case "select":
      return stage.keys;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
      return selectItemNames(stage.selectAll);
    case "union":
      return null;
    default:
      return assertNever(stage);
  }
}

function selectItemNames(items: SelectItem[]): string[] | null {
  const names: string[] = [];
  for (const item of items) {
    const name = selectItemName(item);
    if (!name) return null;
    names.push(name);
  }
  return names;
}

function selectItemName(item: SelectItem): string | null {
  return selectItemOutputName(item);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
