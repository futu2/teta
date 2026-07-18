import { userError } from "./errors.ts";

export function createStringRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function setStringRecordValue<T>(
  record: Record<string, T>,
  key: string,
  value: T
): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function hasOwnStringKey(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

type StringKeyOf<T> = Extract<keyof T, string>;
type NonEmptyRecordKeys = readonly [string, ...string[]];

/** Result shape produced by {@link pick}. */
export type PickRecord<T, TKeys extends readonly string[]> = Pick<T, TKeys[number] & keyof T>;

/** Result shape produced by {@link drop}. */
export type DropRecord<T, TKeys extends readonly string[]> = Omit<T, TKeys[number]>;

type RenamePatternPart<
  TPart extends string,
  TKey extends string,
  TEmbedded extends boolean,
> = string extends TPart
  ? TEmbedded extends true ? TKey : string
  : TPart extends `${infer THead}_${infer TTail}`
    ? `${RenamePatternPart<THead, TKey, true>}_${RenamePatternPart<TTail, TKey, true>}`
    : TPart;

/** Result shape produced by {@link rename}. */
export type RenameRecord<T, TPattern extends string> = {
  [K in StringKeyOf<T> as RenamePatternPart<TPattern, K, false>]: T[K];
};

/**
 * Create a record transform that picks named fields without changing the input.
 *
 * Both `pick("id", "name")` and `pick(["id", "name"])` are accepted.
 */
export type PickTransform<TKeys extends readonly string[]> = <
  T extends object & Record<TKeys[number], unknown>,
>(record: T) => PickRecord<T, TKeys>;

export function pick<
  const TKeys extends NonEmptyRecordKeys,
>(keys: TKeys): PickTransform<TKeys>;
export function pick<
  const TKeys extends NonEmptyRecordKeys,
>(...keys: TKeys): PickTransform<TKeys>;
export function pick(
  keysOrFirst: readonly string[] | string,
  ...rest: string[]
): PickTransform<readonly string[]> {
  const keys = Array.isArray(keysOrFirst)
    ? [...keysOrFirst]
    : [keysOrFirst, ...rest];
  assertNonEmptyKeys("pick", keys);

  return ((record: object) => {
    assertRecordObject("pick", record);
    const result = createStringRecord<unknown>();
    for (const key of keys) {
      assertRecordKey("pick", record, key);
      setStringRecordValue(result, key, Reflect.get(record, key));
    }
    return result;
  }) as PickTransform<readonly string[]>;
}

/** Create a record transform that drops named fields without changing the input. */
export type DropTransform<TKeys extends readonly string[]> = <
  T extends object & Record<TKeys[number], unknown>,
>(record: T) => DropRecord<T, TKeys>;

export function drop<
  const TKeys extends NonEmptyRecordKeys,
>(keys: TKeys): DropTransform<TKeys>;
export function drop<
  const TKeys extends NonEmptyRecordKeys,
>(...keys: TKeys): DropTransform<TKeys>;
export function drop(
  keysOrFirst: readonly string[] | string,
  ...rest: string[]
): DropTransform<readonly string[]> {
  const keys = Array.isArray(keysOrFirst)
    ? [...keysOrFirst]
    : [keysOrFirst, ...rest];
  assertNonEmptyKeys("drop", keys);

  return ((record: object) => {
    assertRecordObject("drop", record);
    const dropped = new Set(keys);
    const result = createStringRecord<unknown>();
    for (const key of Object.keys(record)) {
      if (!dropped.has(key)) {
        setStringRecordValue(result, key, Reflect.get(record, key));
      }
    }
    return result;
  }) as DropTransform<readonly string[]>;
}

/** Create a record transform that renames every field with a key-mapping function. */
export type RenameTransform<TPattern extends string> = <T extends object>(
  record: T,
) => RenameRecord<T, TPattern>;

export function rename<
  const TPattern extends string,
>(renameKey: (key: string) => TPattern): RenameTransform<TPattern> {
  if (typeof renameKey !== "function") {
    userError("DEFERRED_INPUT_INVALID", "rename() expects a key-mapping function");
  }

  return ((record: object) => {
    assertRecordObject("rename", record);
    const result = createStringRecord<unknown>();
    for (const key of Object.keys(record)) {
      const renamed = renameKey(key);
      if (typeof renamed !== "string" || renamed.trim().length === 0) {
        userError("DEFERRED_INPUT_INVALID", "rename() must return a non-empty column name");
      }
      if (hasOwnStringKey(result, renamed)) {
        userError("DEFERRED_INPUT_INVALID", `rename() produced duplicate column name '${renamed}'`);
      }
      setStringRecordValue(result, renamed, Reflect.get(record, key));
    }
    return result;
  }) as RenameTransform<TPattern>;
}

function assertRecordObject(helper: string, value: unknown): asserts value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() expects a record object`);
  }
}

function assertNonEmptyKeys(helper: string, keys: readonly string[]): void {
  if (keys.length === 0) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() expects at least one key`);
  }
}

function assertRecordKey(helper: string, record: object, key: string): void {
  if (!hasOwnStringKey(record, key)) {
    userError("DEFERRED_COLUMN_UNKNOWN", `${helper}() key '${key}' does not exist on the record`);
  }
}
