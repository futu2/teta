import { and, eq } from "../expr.ts";
import type { ColumnRefs, ExprLike, ExprRef, ExprRefs } from "../expr.ts";
import { userError } from "../errors.ts";

type JoinSelection = Record<string, ExprLike<unknown>>;

type JoinOverlappingColumnNames<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = Extract<keyof TLeft, keyof TRight> & string;

type PrefixKeys<TColumns extends Record<string, any>, TPrefix extends string> = {
  [K in keyof TColumns as K extends string ? `${TPrefix}${K}` : never]: TColumns[K];
};

type SuffixKeys<TColumns extends Record<string, any>, TSuffix extends string> = {
  [K in keyof TColumns as K extends string ? `${K}${TSuffix}` : never]: TColumns[K];
};

type RenameOverlapLeftKeys<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TPrefix extends string,
> = {
  [K in keyof TLeft as K extends string
    ? K extends JoinOverlappingColumnNames<TLeft, TRight>
      ? `${TPrefix}${K}`
      : K
    : never]: TLeft[K];
};

type RenameOverlapRightKeys<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TPrefix extends string,
> = {
  [K in keyof TRight as K extends string
    ? K extends JoinOverlappingColumnNames<TLeft, TRight>
      ? `${TPrefix}${K}`
      : K
    : never]: TRight[K];
};

type DropOverlapLeftKeys<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = Omit<TLeft, JoinOverlappingColumnNames<TLeft, TRight>>;

type DropOverlapRightKeys<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = Omit<TRight, JoinOverlappingColumnNames<TLeft, TRight>>;

type JoinMergeConflictGuard<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TExtraConflicts extends string = never,
> = [Extract<keyof TLeft, keyof TRight> & string | TExtraConflicts] extends [never] ? unknown
  : {
      __teta_join_merge_conflict__: Extract<keyof TLeft, keyof TRight> & string | TExtraConflicts;
    };

type JoinHelperSelection<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TExtraConflicts extends string = never,
> = ExprRefs<TLeft & TRight> & JoinMergeConflictGuard<TLeft, TRight, TExtraConflicts>;

type PrefixOverlapLeftSelfConflicts<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TPrefix extends string,
> = Extract<
  `${TPrefix}${JoinOverlappingColumnNames<TLeft, TRight>}`,
  Exclude<keyof TLeft, JoinOverlappingColumnNames<TLeft, TRight>> & string
>;

type PrefixOverlapRightSelfConflicts<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TPrefix extends string,
> = Extract<
  `${TPrefix}${JoinOverlappingColumnNames<TLeft, TRight>}`,
  Exclude<keyof TRight, JoinOverlappingColumnNames<TLeft, TRight>> & string
>;

export function usingCols<const TName extends string>(
  name: TName
): <
  TLeft extends Record<TName, any>,
  TRight extends Record<TName, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean | null>;
export function usingCols<const TNames extends readonly string[]>(
  names: TNames
): <
  TLeft extends Record<TNames[number], any>,
  TRight extends Record<TNames[number], any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean | null>;
export function usingCols(nameOrNames: string | readonly string[]) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];

  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): ExprRef<boolean | null> {
    let predicate: ExprRef<boolean | null> | undefined;

    for (const name of names) {
      const next = eq(
        left[name as keyof typeof left] as ExprLike<any>,
        right[name as keyof typeof right] as ExprLike<any>
      );
      predicate = predicate ? and(predicate, next) : next;
    }

    if (!predicate) {
      userError("INVALID_FUNCTION_NAME", "usingCols requires at least one column");
    }
    return predicate;
  };
}

export function onEq<const TMapping extends Record<string, string>>(
  mapping: TMapping
): <
  TLeft extends Record<Extract<keyof TMapping, string>, any>,
  TRight extends Record<TMapping[Extract<keyof TMapping, string>] & string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean | null>;
export function onEq<const TMapping extends Record<string, string>>(
  mapping: TMapping
) {
  type LeftKey = Extract<keyof TMapping, string>;
  type RightKey = TMapping[LeftKey] & string;

  return function <
    TLeft extends Record<LeftKey, any>,
    TRight extends Record<RightKey, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): ExprRef<boolean | null> {
    let predicate: ExprRef<boolean | null> | undefined;

    for (const [leftName, rightName] of Object.entries(mapping) as Array<[LeftKey, RightKey]>) {
      const next = eq(
        left[leftName as keyof typeof left] as ExprLike<any>,
        right[rightName as unknown as keyof typeof right] as ExprLike<any>
      );
      predicate = predicate ? and(predicate, next) : next;
    }

    if (!predicate) {
      userError("INVALID_FUNCTION_NAME", "onEq requires at least one mapping");
    }
    return predicate;
  };
}

export function prefixOverlapLeft<const TPrefix extends string>(
  prefix: TPrefix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<
  RenameOverlapLeftKeys<TLeft, TRight, TPrefix>,
  TRight,
  PrefixOverlapLeftSelfConflicts<TLeft, TRight, TPrefix>
>;
export function prefixOverlapLeft<const TPrefix extends string>(prefix: TPrefix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<
    RenameOverlapLeftKeys<TLeft, TRight, TPrefix>,
    TRight,
    PrefixOverlapLeftSelfConflicts<TLeft, TRight, TPrefix>
  > {
    const overlapping = new Set(getOverlappingColumnNames(Object.keys(left), Object.keys(right)));
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      const outputKey = overlapping.has(key) ? `${prefix}${key}` : key;
      assignJoinMergeColumn(merged, outputKey, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, key, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<
      RenameOverlapLeftKeys<TLeft, TRight, TPrefix>,
      TRight,
      PrefixOverlapLeftSelfConflicts<TLeft, TRight, TPrefix>
    >;
  };
}

export function prefixOverlapRight<const TPrefix extends string>(
  prefix: TPrefix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<
  TLeft,
  RenameOverlapRightKeys<TLeft, TRight, TPrefix>,
  PrefixOverlapRightSelfConflicts<TLeft, TRight, TPrefix>
>;
export function prefixOverlapRight<const TPrefix extends string>(prefix: TPrefix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<
    TLeft,
    RenameOverlapRightKeys<TLeft, TRight, TPrefix>,
    PrefixOverlapRightSelfConflicts<TLeft, TRight, TPrefix>
  > {
    const overlapping = new Set(getOverlappingColumnNames(Object.keys(left), Object.keys(right)));
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, key, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      const outputKey = overlapping.has(key) ? `${prefix}${key}` : key;
      assignJoinMergeColumn(merged, outputKey, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<
      TLeft,
      RenameOverlapRightKeys<TLeft, TRight, TPrefix>,
      PrefixOverlapRightSelfConflicts<TLeft, TRight, TPrefix>
    >;
  };
}

export function prefixAllLeft<const TPrefix extends string>(
  prefix: TPrefix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<PrefixKeys<TLeft, TPrefix>, TRight>;
export function prefixAllLeft<const TPrefix extends string>(prefix: TPrefix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<PrefixKeys<TLeft, TPrefix>, TRight> {
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, `${prefix}${key}`, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, key, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<PrefixKeys<TLeft, TPrefix>, TRight>;
  };
}

export function prefixAllRight<const TPrefix extends string>(
  prefix: TPrefix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<TLeft, PrefixKeys<TRight, TPrefix>>;
export function prefixAllRight<const TPrefix extends string>(prefix: TPrefix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<TLeft, PrefixKeys<TRight, TPrefix>> {
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, key, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, `${prefix}${key}`, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<TLeft, PrefixKeys<TRight, TPrefix>>;
  };
}

export function suffixAllLeft<const TSuffix extends string>(
  suffix: TSuffix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<SuffixKeys<TLeft, TSuffix>, TRight>;
export function suffixAllLeft<const TSuffix extends string>(suffix: TSuffix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<SuffixKeys<TLeft, TSuffix>, TRight> {
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, `${key}${suffix}`, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, key, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<SuffixKeys<TLeft, TSuffix>, TRight>;
  };
}

export function suffixAllRight<const TSuffix extends string>(
  suffix: TSuffix
): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<TLeft, SuffixKeys<TRight, TSuffix>>;
export function suffixAllRight<const TSuffix extends string>(suffix: TSuffix) {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<TLeft, SuffixKeys<TRight, TSuffix>> {
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, key, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, `${key}${suffix}`, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<TLeft, SuffixKeys<TRight, TSuffix>>;
  };
}

export function dropOverlapLeft(): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<DropOverlapLeftKeys<TLeft, TRight>, TRight>;
export function dropOverlapLeft() {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<DropOverlapLeftKeys<TLeft, TRight>, TRight> {
    const overlapping = new Set(getOverlappingColumnNames(Object.keys(left), Object.keys(right)));
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      if (overlapping.has(key)) continue;
      assignJoinMergeColumn(merged, key, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      assignJoinMergeColumn(merged, key, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<DropOverlapLeftKeys<TLeft, TRight>, TRight>;
  };
}

export function dropOverlapRight(): <
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => JoinHelperSelection<TLeft, DropOverlapRightKeys<TLeft, TRight>>;
export function dropOverlapRight() {
  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): JoinHelperSelection<TLeft, DropOverlapRightKeys<TLeft, TRight>> {
    const overlapping = new Set(getOverlappingColumnNames(Object.keys(left), Object.keys(right)));
    const merged: JoinSelection = {};

    for (const key of Object.keys(left)) {
      assignJoinMergeColumn(merged, key, left[key as keyof typeof left]);
    }
    for (const key of Object.keys(right)) {
      if (overlapping.has(key)) continue;
      assignJoinMergeColumn(merged, key, right[key as keyof typeof right]);
    }

    return merged as JoinHelperSelection<TLeft, DropOverlapRightKeys<TLeft, TRight>>;
  };
}

function getOverlappingColumnNames(
  leftNames: readonly string[],
  rightNames: readonly string[]
): string[] {
  if (leftNames.length === 0 || rightNames.length === 0) return [];
  const right = new Set(rightNames);
  return leftNames.filter((name) => right.has(name));
}

function assignJoinMergeColumn(
  target: JoinSelection,
  key: string,
  value: ExprLike<unknown>
): void {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    userError("JOIN_MERGE_CONFLICT", `join merge helper still overlaps after renaming: ${key}`);
  }
  target[key] = value;
}
