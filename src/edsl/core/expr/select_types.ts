import type { IdentifierInput, Value } from "../types";
import type { ExprInput, ExprRef } from "./runtime";
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

export type ProjectInput = ExprRef<unknown> | Value;

export type SpreadableProjectionShape<S extends Record<string, unknown>> = {
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

export type ProjectionRemapInput = Readonly<Record<string, IdentifierInput>>;

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

export type PrefixedProjectionComposables<
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

export type RemappedProjectionComposables<
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

export type ProjectionKey<S extends Record<string, unknown>> = keyof S & string;

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

export type ProjectionComposableListKey<P extends ProjectionComposableList> = P extends readonly [
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

export type ValidatedProjectionRemap<
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

