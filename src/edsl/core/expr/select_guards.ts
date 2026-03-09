import type {
  AliasedSelectValue,
  ProjectionComposableList,
  ProjectionItem,
  ProjectionPreset,
  ProjectionSpread,
  SelectValue,
} from "./select_types";

export function isAliasedSelectValue(value: unknown): value is AliasedSelectValue<unknown> {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "select_alias";
}

export function isProjectionPreset(value: unknown): value is ProjectionPreset<ProjectionComposableList> {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "select_preset";
}

export function isProjectionSpread(value: unknown): value is ProjectionSpread<Record<string, unknown>> {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "select_spread";
}

export function isProjectionItem(value: unknown): value is ProjectionItem<string, SelectValue> {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "select_projection";
}
