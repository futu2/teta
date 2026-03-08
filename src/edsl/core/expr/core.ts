import type {
  AggFunc,
  BinaryOp,
  DateLiteral,
  ExprNode,
  IdentifierInput,
  OrderItem,
  TimestampLiteral,
  Value,
} from "../types";
import type { SqlRenderer, SqlResult } from "../../sql/types";
import {
  containsGroup,
  dedupeExprs,
  shouldAlias,
  unwrapGroupExpr,
} from "./node/ops";

type LiteralInput<T> = T extends number ? number : T;
export type ExprInput<T> = ExprRef<T> | LiteralInput<T>;
export type ExprInputTuple<T extends readonly unknown[]> = {
  [K in keyof T]: ExprInput<T[K]>;
};
export type NonNull<T> = Exclude<T, null>;
export type PropagateNull<TInput, TResult> = null extends TInput ? TResult | null : TResult;
export type CaseBuilder<T> = {
  when: (condition: ExprInput<boolean>, value: ExprInput<T>) => CaseBuilder<T>;
  else: (value: ExprInput<T>) => ExprRef<T>;
  end: () => ExprRef<T | null>;
};

export type WindowSpecInput = {
  partitionBy?: ExprRef<unknown> | ExprRef<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

export interface ExprRef<T> {}

export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}

  toSql(renderer: SqlRenderer<any, SqlResult>): string {
    return renderer.toSql(this);
  }

  toSqlResult<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSqlResult(this);
  }

  via<A extends unknown[], R>(
    operation: (expr: ExprRef<T>, ...args: A) => R,
    ...args: A
  ): R {
    return operation(this, ...args);
  }
}

export class ColumnRef<T, Name extends string> extends ExprRef<T> {
  readonly table: string | null;
  readonly name: Name;

  constructor(table: string | null, name: Name) {
    super({ kind: "column", table, name });
    this.table = table;
    this.name = name;
  }
}

export type ColumnRefs<T extends Record<string, unknown>> = {
  [K in keyof T & string]: ColumnRef<T[K], K>;
};
export type ExprRefs<T extends Record<string, unknown>> = {
  [K in keyof T & string]: ExprRef<T[K]>;
};

export type AliasedSelectValue<T> = {
  kind: "select_alias";
  value: ExprInput<T>;
  as: IdentifierInput;
};

export type SelectValue = ExprRef<unknown> | Value | AliasedSelectValue<unknown>;
export type SelectValueResult<V> = V extends AliasedSelectValue<infer T>
  ? T
  : V extends ExprRef<infer T>
    ? T
    : V;
export type SelectShape = Record<string, SelectValue>;
export type SelectResult<S extends SelectShape> = {
  [K in keyof S]: SelectValueResult<S[K]>;
};

type ProjectInput = ExprRef<unknown> | Value;

type SpreadableProjectionShape<S extends Record<string, unknown>> = {
  [K in keyof S]: S[K] extends SelectValue ? S[K] : never;
};

export type ProjectionSpread<S extends Record<string, unknown> = Record<string, SelectValue>> = {
  kind: "select_spread";
  items: SpreadableProjectionShape<S>;
};

export type ProjectionItem<
  Name extends string,
  TValue extends SelectValue = SelectValue,
> = {
  kind: "select_projection";
  key: Name;
  value: TValue;
};

export type ProjectionPart = ProjectionItem<string, SelectValue> | ProjectionSpread<any>;
export type ProjectionPartList = readonly ProjectionPart[];
export type ProjectionPreset<P extends readonly unknown[] = readonly unknown[]> = {
  kind: "select_preset";
  parts: P;
};
export type ProjectionComposable = ProjectionPart | ProjectionPreset<any>;
export type ProjectionComposableList = readonly ProjectionComposable[];
export type ProjectionList = readonly ProjectionItem<string, SelectValue>[];

export type ProjectionPrefixOptions<Separator extends string = "_"> = {
  separator?: Separator;
};

type ProjectionIdentifierName<T extends IdentifierInput> = T extends string
  ? T
  : T extends { name: infer Name extends string }
    ? Name
    : never;

type ProjectionRemapInput = Readonly<Record<string, IdentifierInput>>;

type ProjectionPresetParts<P> = P extends ProjectionPreset<infer Parts>
  ? Parts extends ProjectionComposableList
    ? Parts
    : readonly []
  : never;

type PrefixedProjectionKey<
  Prefix extends string,
  Separator extends string,
  Key extends string,
> = `${Prefix}${Separator}${Key}`;

type RemappedProjectionKey<
  Map extends ProjectionRemapInput,
  Key extends string,
> = Key extends keyof Map & string ? ProjectionIdentifierName<Map[Key]> : Key;

type PrefixedProjectionSpread<
  Prefix extends string,
  Separator extends string,
  S extends Record<string, unknown>,
> = ProjectionSpread<{
  [K in keyof S & string as PrefixedProjectionKey<Prefix, Separator, K>]: S[K];
}>;

type RemappedProjectionSpread<
  Map extends ProjectionRemapInput,
  S extends Record<string, unknown>,
> = ProjectionSpread<{
  [K in keyof S & string as RemappedProjectionKey<Map, K>]: S[K];
}>;

type PrefixedProjectionItem<
  Prefix extends string,
  Separator extends string,
  P extends ProjectionItem<string, SelectValue>,
> = P extends ProjectionItem<infer Name extends string, infer TValue extends SelectValue>
  ? ProjectionItem<PrefixedProjectionKey<Prefix, Separator, Name>, TValue>
  : never;

type RemappedProjectionItem<
  Map extends ProjectionRemapInput,
  P extends ProjectionItem<string, SelectValue>,
> = P extends ProjectionItem<infer Name extends string, infer TValue extends SelectValue>
  ? ProjectionItem<RemappedProjectionKey<Map, Name>, TValue>
  : never;

type PrefixedProjectionComposable<
  Prefix extends string,
  Separator extends string,
  P extends ProjectionComposable,
> = [ProjectionPresetParts<P>] extends [never]
  ? P extends ProjectionSpread<infer S>
    ? PrefixedProjectionSpread<Prefix, Separator, S>
    : P extends ProjectionItem<string, SelectValue>
      ? PrefixedProjectionItem<Prefix, Separator, P>
      : never
  : ProjectionPreset<PrefixedProjectionComposables<Prefix, Separator, ProjectionPresetParts<P>>>;

type RemappedProjectionComposable<
  Map extends ProjectionRemapInput,
  P extends ProjectionComposable,
> = [ProjectionPresetParts<P>] extends [never]
  ? P extends ProjectionSpread<infer S>
    ? RemappedProjectionSpread<Map, S>
    : P extends ProjectionItem<string, SelectValue>
      ? RemappedProjectionItem<Map, P>
      : never
  : ProjectionPreset<RemappedProjectionComposables<Map, ProjectionPresetParts<P>>>;

type PrefixedProjectionComposables<
  Prefix extends string,
  Separator extends string,
  P extends ProjectionComposableList,
> = P extends readonly [infer Head, ...infer Tail]
  ? Head extends ProjectionComposable
    ? Tail extends ProjectionComposableList
      ? [
          PrefixedProjectionComposable<Prefix, Separator, Head>,
          ...PrefixedProjectionComposables<Prefix, Separator, Tail>,
        ]
      : [PrefixedProjectionComposable<Prefix, Separator, Head>]
    : []
  : [];

type RemappedProjectionComposables<
  Map extends ProjectionRemapInput,
  P extends ProjectionComposableList,
> = P extends readonly [infer Head, ...infer Tail]
  ? Head extends ProjectionComposable
    ? Tail extends ProjectionComposableList
      ? [
          RemappedProjectionComposable<Map, Head>,
          ...RemappedProjectionComposables<Map, Tail>,
        ]
      : [RemappedProjectionComposable<Map, Head>]
    : []
  : [];

type DuplicateRemappedProjectionName<
  Map extends ProjectionRemapInput,
  Keys extends string,
  Key extends string = Keys,
> = Key extends string
  ? RemappedProjectionKey<Map, Key> extends RemappedProjectionKey<Map, Exclude<Keys, Key>>
    ? RemappedProjectionKey<Map, Key>
    : never
  : never;

type ProjectionKey<S extends Record<string, unknown>> = keyof S & string;

type ProjectionPartKey<P extends ProjectionPart> = P extends ProjectionItem<infer Name, SelectValue>
  ? Name
  : P extends ProjectionSpread<infer S>
    ? keyof S & string
    : never;

type ProjectionComposableKey<P extends ProjectionComposable> = [ProjectionPresetParts<P>] extends [never]
  ? P extends ProjectionPart
    ? ProjectionPartKey<P>
    : never
  : ProjectionComposableListKey<ProjectionPresetParts<P>>;

type ProjectionComposableListKey<P extends ProjectionComposableList> = P extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends ProjectionComposable
    ? Tail extends ProjectionComposableList
      ? ProjectionComposableKey<Head> | ProjectionComposableListKey<Tail>
      : ProjectionComposableKey<Head>
    : never
  : never;

type ProjectionItemsFromPart<P extends ProjectionPart> = P extends ProjectionItem<
  infer Name extends string,
  infer TValue extends SelectValue
>
  ? [ProjectionItem<Name, TValue>]
  : P extends ProjectionSpread<infer S>
    ? Array<{
        [K in keyof S & string]: ProjectionItem<K, S[K] extends SelectValue ? S[K] : never>;
      }[keyof S & string]>
    : never;

type ProjectionItemsFromComposable<P extends ProjectionComposable> = [ProjectionPresetParts<P>] extends [never]
  ? P extends ProjectionPart
    ? ProjectionItemsFromPart<P>
    : []
  : ProjectionListFromComposables<ProjectionPresetParts<P>>;

export type ProjectionListFromComposables<P extends ProjectionComposableList> = P extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends ProjectionComposable
    ? Tail extends ProjectionComposableList
      ? [...ProjectionItemsFromComposable<Head>, ...ProjectionListFromComposables<Tail>]
      : ProjectionItemsFromComposable<Head>
    : []
  : [];

export type ProjectionListFromParts<P extends ProjectionPartList> = ProjectionListFromComposables<P>;

export type ProjectionListResult<P extends ProjectionList> = {
  [I in P[number] as I["key"]]: SelectValueResult<I["value"]>;
};

type IsTuple<T extends readonly unknown[]> = number extends T["length"] ? false : true;

type DuplicateProjectionKey<
  P extends ProjectionList,
  Seen extends string = never,
> = IsTuple<P> extends false
  ? never
  : P extends readonly [infer Head, ...infer Tail]
    ? Head extends ProjectionItem<infer Name, SelectValue>
      ? Name extends Seen
        ? Name
        : Tail extends ProjectionList
          ? DuplicateProjectionKey<Tail, Seen | Name>
          : never
      : never
    : never;

type DuplicateProjectionComposableKey<
  P extends ProjectionComposableList,
  Seen extends string = never,
> = IsTuple<P> extends false
  ? never
  : P extends readonly [infer Head, ...infer Tail]
    ? Head extends ProjectionPreset<infer Parts>
      ? Parts extends ProjectionComposableList
        ? [DuplicateProjectionComposableKey<Parts, Seen>] extends [never]
          ? Tail extends ProjectionComposableList
            ? DuplicateProjectionComposableKey<Tail, Seen | ProjectionComposableListKey<Parts>>
            : never
          : DuplicateProjectionComposableKey<Parts, Seen>
        : never
      : Head extends ProjectionPart
        ? [Extract<ProjectionPartKey<Head>, Seen>] extends [never]
          ? Tail extends ProjectionComposableList
            ? DuplicateProjectionComposableKey<Tail, Seen | ProjectionPartKey<Head>>
            : never
          : Extract<ProjectionPartKey<Head>, Seen>
        : never
    : never;


type ProjectionListDuplicateError<Key extends string> = {
  __duplicate_projection_key__: `Duplicate projected column name: ${Key}`;
};

export type ValidatedProjectionList<P extends ProjectionList> = [DuplicateProjectionKey<P>] extends [never]
  ? P
  : ProjectionListDuplicateError<DuplicateProjectionKey<P>>;

export type ValidatedProjectionComposables<P extends ProjectionComposableList> = [
  DuplicateProjectionComposableKey<P>,
] extends [never]
  ? P
  : ProjectionListDuplicateError<DuplicateProjectionComposableKey<P>>;

type ValidatedProjectionRemap<
  P extends ProjectionComposableList,
  Map extends Partial<Record<ProjectionComposableListKey<P>, IdentifierInput>>,
> = [DuplicateRemappedProjectionName<Map & ProjectionRemapInput, ProjectionComposableListKey<P>>] extends [never]
  ? Map
  : ProjectionListDuplicateError<
      DuplicateRemappedProjectionName<Map & ProjectionRemapInput, ProjectionComposableListKey<P>>
    >;

export type ValidatedProjectionParts<P extends ProjectionPartList> = ValidatedProjectionComposables<P>;

export type SelectSelection = SelectShape | ProjectionList;
export type ValidatedSelectSelection<S extends SelectSelection> = S extends ProjectionList
  ? ValidatedProjectionList<S>
  : S;
export type SelectSelectionResult<S extends SelectSelection> = S extends ProjectionList
  ? ProjectionListResult<S>
  : S extends SelectShape
    ? SelectResult<S>
    : never;

export function alias<T>(value: ExprInput<T>, as: IdentifierInput): AliasedSelectValue<T> {
  return { kind: "select_alias", value, as };
}

export function project<const Name extends string, TValue extends ProjectInput>(
  name: Name,
  value: TValue,
  options?: { quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function project<const Name extends string, TValue extends ProjectInput>(
  identifier: { name: Name; quoted?: boolean },
  value: TValue
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function project(
  nameOrIdentifier: string | { name: string; quoted?: boolean },
  value: ProjectInput,
  options?: { quoted?: boolean }
): ProjectionItem<string, AliasedSelectValue<unknown>> {
  const key = typeof nameOrIdentifier === "string" ? nameOrIdentifier : nameOrIdentifier.name;
  const as =
    typeof nameOrIdentifier === "string"
      ? options?.quoted
        ? { name: key, quoted: true }
        : key
      : nameOrIdentifier;
  return {
    kind: "select_projection",
    key,
    value: alias(value as ExprInput<unknown>, as),
  };
}

export function rename<const Name extends string, TValue extends ProjectInput>(
  value: TValue,
  name: Name,
  options?: { quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function rename<const Name extends string, TValue extends ProjectInput>(
  value: TValue,
  identifier: { name: Name; quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function rename(
  value: ProjectInput,
  nameOrIdentifier: string | { name: string; quoted?: boolean },
  options?: { quoted?: boolean }
): ProjectionItem<string, AliasedSelectValue<unknown>> {
  return typeof nameOrIdentifier === "string"
    ? project(nameOrIdentifier, value, options)
    : project(nameOrIdentifier, value);
}

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

export function lit<T extends Value>(value: T): ExprRef<T> {

  return new ExprRef<T>({ kind: "literal", value });
}

export function array<T = unknown>(...values: ExprInput<T>[]): ExprRef<T[]> {
  return new ExprRef<T[]>({
    kind: "array",
    items: values.map((value) => toExprNode(value)),
  });
}

export function fn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): ExprRef<T> {
  if (!name.trim()) {
    throw new Error("fn requires a function name");
  }
  return funcExpr(name, args.map((arg) => toExprNode(arg)));
}

export function windowFn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): WindowBuilder<T> {
  if (!name.trim()) {
    throw new Error("windowFn requires a function name");
  }
  return new WindowBuilder<T>(name, args.map((arg) => toExprNode(arg)));
}

export function wrapExpr<T>(value: ExprInput<T>): ExprRef<T> {
  if (value instanceof ExprRef) return value;
  return new ExprRef<T>(toExprNode(value) as ExprNode<T>);
}

export function aggregateExpr<T>(name: AggFunc, arg: ExprInput<unknown>): ExprRef<T> {
  return new ExprRef<T>({
    kind: "agg",
    name,
    arg: toExprNode(arg),
    distinct: false,
  });
}

export function windowExpr<T>(name: string, ...args: ExprInput<unknown>[]): WindowBuilder<T> {
  return new WindowBuilder<T>(name, args.map((arg) => toExprNode(arg)));
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<unknown> {
  if (value instanceof ExprRef) return value.node;
  if (value === undefined) {
    throw new Error("Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return { kind: "literal", value: value as Value };
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value };
  }
  throw new Error(`Unsupported literal value: ${String(value)}`);
}

function isTemporalLiteral(value: unknown): value is DateLiteral | TimestampLiteral {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  if (candidate.value !== undefined && typeof candidate.value !== "string") return false;
  return candidate.kind === "date_literal" || candidate.kind === "timestamp_literal";
}

export { containsGroup, unwrapGroupExpr, dedupeExprs, shouldAlias };

export function toExprNodeList(
  input?: ExprRef<unknown> | ExprRef<unknown>[]
): ExprNode<unknown>[] | null {
  if (!input) return null;
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => toExprNode(item));
}

export function toOrderItems(input?: OrderItem | OrderItem[]): OrderItem[] | null {
  if (!input) return null;
  return Array.isArray(input) ? input : [input];
}

export class WindowBuilder<T> {
  constructor(private readonly name: string, private readonly args: ExprNode<unknown>[]) {}

  over(spec: WindowSpecInput = {}): ExprRef<T> {
    const partitionBy = toExprNodeList(spec.partitionBy);
    const orderBy = toOrderItems(spec.orderBy);
    return new ExprRef<T>({
      kind: "window",
      name: this.name,
      args: this.args,
      partitionBy,
      orderBy,
    });
  }
}

export function binaryExpr(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown> {
  return new ExprRef({ kind: "binary", op, left, right });
}

export function funcExpr<T>(name: string, args: ExprNode<unknown>[]): ExprRef<T> {
  return new ExprRef<T>({ kind: "func", name, args });
}
