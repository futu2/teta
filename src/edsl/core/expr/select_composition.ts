import type { IdentifierInput } from "../types";
import { alias } from "./select_alias";
import {
  isAliasedSelectValue,
  isProjectionItem,
  isProjectionPreset,
  isProjectionSpread,
} from "./select_guards";
import type {
  PrefixedProjectionComposables,
  ProjectionComposable,
  ProjectionComposableList,
  ProjectionComposableListKey,
  ProjectionItem,
  ProjectionKey,
  ProjectionListFromComposables,
  ProjectionPrefixOptions,
  ProjectionPreset,
  ProjectionRemapInput,
  ProjectionSpread,
  RemappedProjectionComposables,
  SelectValue,
  SpreadableProjectionShape,
  ValidatedProjectionComposables,
  ValidatedProjectionRemap,
} from "./select_types";

function hasProjectionKey(items: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(items, key);
}

function projectionIdentifierName(identifier: IdentifierInput): string {
  return typeof identifier === "string" ? identifier : identifier.name;
}

function remapProjectionIdentifier(
  currentIdentifier: IdentifierInput,
  nextIdentifier: IdentifierInput
): IdentifierInput {
  if (typeof nextIdentifier === "string") {
    return typeof currentIdentifier === "string"
      ? nextIdentifier
      : {
          ...currentIdentifier,
          name: nextIdentifier,
        };
  }
  return nextIdentifier;
}

function remapProjectionValue(
  value: SelectValue,
  nextIdentifier: IdentifierInput
): SelectValue {
  return isAliasedSelectValue(value)
    ? alias(value.value, remapProjectionIdentifier(value.as, nextIdentifier))
    : value;
}

function isProjectionPrefixOptions(value: unknown): value is ProjectionPrefixOptions<string> {
  return typeof value === "object"
    && value !== null
    && !("kind" in (value as Record<string, unknown>))
    && (
      !Object.prototype.hasOwnProperty.call(value, "separator")
      || typeof (value as { separator?: unknown }).separator === "string"
    );
}

function resolveProjectionPrefixArgs(
  rest: readonly unknown[]
): {
  separator: string;
  parts: ProjectionComposableList;
} {
  const first = rest[0];
  if (isProjectionPrefixOptions(first)) {
    return {
      separator: first.separator ?? "_",
      parts: rest.slice(1) as ProjectionComposableList,
    };
  }

  return {
    separator: "_",
    parts: rest as ProjectionComposableList,
  };
}

function pickProjectionShape<
  const S extends Record<string, unknown>,
  const Keys extends readonly ProjectionKey<S>[],
>(
  items: SpreadableProjectionShape<S>,
  keys: Keys
): SpreadableProjectionShape<Pick<S, Keys[number]>> {
  const picked: Partial<SpreadableProjectionShape<Pick<S, Keys[number]>>> = {};
  for (const key of keys) {
    if (!hasProjectionKey(items, key)) {
      throw new Error(`Unknown projection key: ${key}`);
    }
    picked[key] = items[key] as SpreadableProjectionShape<Pick<S, Keys[number]>>[typeof key];
  }
  return picked as SpreadableProjectionShape<Pick<S, Keys[number]>>;
}

function omitProjectionShape<
  const S extends Record<string, unknown>,
  const Keys extends readonly ProjectionKey<S>[],
>(
  items: SpreadableProjectionShape<S>,
  keys: Keys
): SpreadableProjectionShape<Omit<S, Keys[number]>> {
  for (const key of keys) {
    if (!hasProjectionKey(items, key)) {
      throw new Error(`Unknown projection key: ${key}`);
    }
  }

  const omitted = new Set<string>(keys);
  const next: Record<string, SelectValue> = {};
  for (const key of Object.keys(items) as ProjectionKey<S>[]) {
    if (omitted.has(key)) continue;
    next[key] = items[key] as SelectValue;
  }
  return next as SpreadableProjectionShape<Omit<S, Keys[number]>>;
}

function prefixedProjectionKey(prefix: string, separator: string, key: string): string {
  return `${prefix}${separator}${key}`;
}

function projectionComposableKeys(parts: ProjectionComposableList): Set<string> {
  const keys = new Set<string>();
  for (const part of parts) {
    if (isProjectionPreset(part)) {
      for (const key of projectionComposableKeys(part.parts as ProjectionComposableList)) {
        keys.add(key);
      }
      continue;
    }

    if (isProjectionSpread(part)) {
      for (const key of Object.keys(part.items)) {
        keys.add(key);
      }
      continue;
    }

    if (isProjectionItem(part)) {
      keys.add(part.key);
    }
  }
  return keys;
}

function assertKnownProjectionRemapKeys(
  map: ProjectionRemapInput,
  parts: ProjectionComposableList
): void {
  const keys = projectionComposableKeys(parts);
  for (const key of Object.keys(map)) {
    if (!keys.has(key)) {
      throw new Error(`Unknown projection remap key: ${key}`);
    }
  }
}

function prefixProjectionComposable(
  prefix: string,
  separator: string,
  part: ProjectionComposable
): ProjectionComposable {
  if (isProjectionPreset(part)) {
    return preset(
      ...((part.parts as ProjectionComposableList).map((nestedPart) =>
        prefixProjectionComposable(prefix, separator, nestedPart)
      ) as ProjectionComposableList)
    );
  }

  if (isProjectionSpread(part)) {
    const items: Record<string, SelectValue> = {};
    for (const key of Object.keys(part.items)) {
      const nextKey = prefixedProjectionKey(prefix, separator, key);
      items[nextKey] = remapProjectionValue(part.items[key]!, nextKey);
    }
    return spread(items);
  }

  if (!isProjectionItem(part)) {
    return part;
  }

  const nextKey = prefixedProjectionKey(prefix, separator, part.key);
  return {
    kind: "select_projection",
    key: nextKey,
    value: remapProjectionValue(part.value, nextKey),
  };
}

function remapProjectionComposable(
  map: ProjectionRemapInput,
  part: ProjectionComposable
): ProjectionComposable {
  if (isProjectionPreset(part)) {
    return preset(
      ...((part.parts as ProjectionComposableList).map((nestedPart) =>
        remapProjectionComposable(map, nestedPart)
      ) as ProjectionComposableList)
    );
  }

  if (isProjectionSpread(part)) {
    const items: Record<string, SelectValue> = {};
    for (const key of Object.keys(part.items)) {
      const nextIdentifier = Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : key;
      const nextKey = projectionIdentifierName(nextIdentifier);
      items[nextKey] = remapProjectionValue(part.items[key]!, nextIdentifier);
    }
    return spread(items);
  }

  if (!isProjectionItem(part)) {
    return part;
  }

  const nextIdentifier = Object.prototype.hasOwnProperty.call(map, part.key) ? map[part.key]! : part.key;
  const nextKey = projectionIdentifierName(nextIdentifier);
  return {
    kind: "select_projection",
    key: nextKey,
    value: remapProjectionValue(part.value, nextIdentifier),
  };
}

function pushProjectionComposable(
  items: ProjectionItem<string, SelectValue>[],
  part: ProjectionComposable
): void {
  if (isProjectionPreset(part)) {
    for (const nestedPart of part.parts as ProjectionComposableList) {
      pushProjectionComposable(items, nestedPart);
    }
    return;
  }

  if (isProjectionSpread(part)) {
    for (const key of Object.keys(part.items)) {
      items.push({
        kind: "select_projection",
        key,
        value: part.items[key]!,
      });
    }
    return;
  }

  if (isProjectionItem(part)) {
    items.push(part);
  }
}

export function spread<const S extends Record<string, unknown>>(items: SpreadableProjectionShape<S>): ProjectionSpread<S> {
  return {
    kind: "select_spread",
    items,
  };
}

export function selectAll<const S extends Record<string, unknown>>(
  items: SpreadableProjectionShape<S>
): ProjectionPreset<readonly [ProjectionSpread<S>]> {
  return {
    kind: "select_preset",
    parts: [spread(items)] as const,
  };
}

export function pick<
  const S extends Record<string, unknown>,
  const Keys extends readonly ProjectionKey<S>[],
>(
  items: SpreadableProjectionShape<S>,
  ...keys: Keys
): ProjectionSpread<Pick<S, Keys[number]>> {
  return spread(pickProjectionShape(items, keys));
}

export function omit<
  const S extends Record<string, unknown>,
  const Keys extends readonly ProjectionKey<S>[],
>(
  items: SpreadableProjectionShape<S>,
  ...keys: Keys
): ProjectionSpread<Omit<S, Keys[number]>> {
  return spread(omitProjectionShape(items, keys));
}

export function preset<const P extends ProjectionComposableList>(
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<P> {
  return {
    kind: "select_preset",
    parts,
  };
}

export function prefix<
  const Prefix extends string,
  const P extends ProjectionComposableList,
>(
  prefixValue: Prefix,
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<PrefixedProjectionComposables<Prefix, "_", P>>;
export function prefix<
  const Prefix extends string,
  const Separator extends string,
  const P extends ProjectionComposableList,
>(
  prefixValue: Prefix,
  options: ProjectionPrefixOptions<Separator>,
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<PrefixedProjectionComposables<Prefix, Separator, P>>;
export function prefix(
  prefixValue: string,
  ...rest: readonly unknown[]
): ProjectionPreset<ProjectionComposableList> {
  const { separator, parts } = resolveProjectionPrefixArgs(rest);
  return preset(
    ...(parts.map((part) => prefixProjectionComposable(prefixValue, separator, part)) as ProjectionComposableList)
  );
}

export function namespace<
  const Prefix extends string,
  const P extends ProjectionComposableList,
>(
  prefixValue: Prefix,
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<PrefixedProjectionComposables<Prefix, "_", P>>;
export function namespace<
  const Prefix extends string,
  const Separator extends string,
  const P extends ProjectionComposableList,
>(
  prefixValue: Prefix,
  options: ProjectionPrefixOptions<Separator>,
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<PrefixedProjectionComposables<Prefix, Separator, P>>;
export function namespace(
  prefixValue: string,
  ...rest: readonly unknown[]
): ProjectionPreset<ProjectionComposableList> {
  const { separator, parts } = resolveProjectionPrefixArgs(rest);
  return preset(
    ...(parts.map((part) => prefixProjectionComposable(prefixValue, separator, part)) as ProjectionComposableList)
  );
}

export function remap<
  const P extends ProjectionComposableList,
  const Map extends Partial<Record<ProjectionComposableListKey<P>, IdentifierInput>>,
>(
  map: ValidatedProjectionRemap<P, Map> extends Map ? Map : never,
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionPreset<RemappedProjectionComposables<Map & ProjectionRemapInput, P>>;
export function remap(
  map: ProjectionRemapInput,
  ...parts: ProjectionComposableList
): ProjectionPreset<ProjectionComposableList> {
  assertKnownProjectionRemapKeys(map, parts);
  return preset(
    ...(parts.map((part) => remapProjectionComposable(map, part)) as ProjectionComposableList)
  );
}

export function projects<const P extends ProjectionComposableList>(
  ...parts: ValidatedProjectionComposables<P> extends P ? P : never
): ProjectionListFromComposables<P> {
  const items: ProjectionItem<string, SelectValue>[] = [];
  for (const part of parts) {
    pushProjectionComposable(items, part);
  }
  return items as ProjectionListFromComposables<P>;
}
