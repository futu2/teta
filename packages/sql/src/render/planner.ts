import type { ScopeId, ProjectionItem, SqlIdentifier, Stage } from "../ir/types.ts";
import { projectionItemOutputName, projectionItemsToIdentifierMap } from "../ir/utils.ts";
import { internalError } from "../errors.ts";

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
    case "map":
    case "fold":
    case "join":
    case "unnest":
    case "union":
      return stage.outputScopeId;
    case "filter":
    case "sort":
    case "distinct":
    case "take":
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
    case "map":
    case "fold":
      return projectionItemsToIdentifierMap(stage.items);
    case "filter":
    case "join":
    case "unnest":
    case "sort":
    case "distinct":
    case "take":
    case "union":
      return projectionItemsToIdentifierMap(stage.projectAll);
    default:
      return assertNever(stage);
  }
}

export function stageOutputNames(stage: Stage): readonly string[] {
  switch (stage.kind) {
    case "map":
    case "fold":
      return stage.keys;
    case "filter":
    case "join":
    case "unnest":
    case "sort":
    case "distinct":
    case "take":
    case "union":
      return projectionItemNames(stage.projectAll);
    default:
      return assertNever(stage);
  }
}

function projectionItemNames(items: readonly ProjectionItem[]): string[] {
  return items.map((item) => {
    const name = projectionItemOutputName(item);
    if (!name) {
      internalError("INTERNAL_STAGE_PROJECTION_ITEM_OUTPUT_NAME_MISSING", "Internal error: stage projection item is missing an output name");
    }
    return name;
  });
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
