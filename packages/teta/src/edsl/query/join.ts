import type { JoinType, JoinTypeInput } from "../core/types.ts";
import { and, eq, mergeColumnNames } from "../expr.ts";
import type { ColumnRefs, ExprRef, ExprRefs } from "../expr.ts";
import { userError } from "../errors.ts";

export type JoinSelection = Record<string, ExprRef<unknown>>;

export type JoinOverlappingColumnNames<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = Extract<keyof TLeft, keyof TRight> & string;

export type JoinNoMergeGuard<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = string extends keyof TLeft ? unknown
  : string extends keyof TRight ? unknown
    : [JoinOverlappingColumnNames<TLeft, TRight>] extends [never] ? unknown
      : {
          __teta_join_overlap_requires_merge__: JoinOverlappingColumnNames<TLeft, TRight>;
        };

export type JoinOn<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => ExprRef<boolean>;

export type JoinOnNoMerge<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = JoinOn<TLeft, TRight> & JoinNoMergeGuard<TLeft, TRight>;

export type JoinSelectionResult<TSelection extends JoinSelection> = {
  [K in keyof TSelection]: TSelection[K] extends ExprRef<infer TValue> ? TValue : never;
};

export type JoinColumnMerger<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TSelection extends JoinSelection = ExprRefs<TLeft & TRight>
> = (
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => TSelection;

type NullableColumns<TColumns extends Record<string, any>> = {
  [K in keyof TColumns]: TColumns[K] | null;
};

type LeftJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = TLeft & NullableColumns<TRight>;

type RightJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = NullableColumns<TLeft> & TRight;

type FullJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
> = NullableColumns<TLeft> & NullableColumns<TRight>;

type InnerJoinType = "inner" | "INNER";
type LeftJoinType = "left" | "LEFT";
type RightJoinType = "right" | "RIGHT";
type FullJoinType = "full" | "FULL";
type JoinKind = "inner" | "left" | "right" | "full";

export type CanonicalJoinType<TType extends JoinTypeInput | undefined> =
  TType extends LeftJoinType ? "left"
  : TType extends RightJoinType ? "right"
    : TType extends FullJoinType ? "full"
      : "inner";

export type JoinColumnsForType<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TType extends JoinKind,
> = TType extends "left"
  ? LeftJoinColumns<TLeft, TRight>
  : TType extends "right"
    ? RightJoinColumns<TLeft, TRight>
    : TType extends "full"
      ? FullJoinColumns<TLeft, TRight>
      : TLeft & TRight;

type JoinLeftColumnsForType<
  TLeft extends Record<string, any>,
  TType extends JoinKind,
> = TType extends "right" | "full" ? NullableColumns<TLeft> : TLeft;

type JoinRightColumnsForType<
  TRight extends Record<string, any>,
  TType extends JoinKind,
> = TType extends "left" | "full" ? NullableColumns<TRight> : TRight;

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

export type JoinOptions<
  TType extends JoinTypeInput | undefined = undefined,
> = {
  type?: TType;
  lateral?: boolean;
};

export function usingCols<const TName extends string>(
  name: TName
): <
  TLeft extends Record<TName, any>,
  TRight extends Record<TName, any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean>;
export function usingCols<const TNames extends readonly string[]>(
  names: TNames
): <
  TLeft extends Record<TNames[number], any>,
  TRight extends Record<TNames[number], any>,
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean>;
export function usingCols(nameOrNames: string | readonly string[]) {
  const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];

  return function <
    TLeft extends Record<string, any>,
    TRight extends Record<string, any>,
  >(
    left: ColumnRefs<TLeft>,
    right: ColumnRefs<TRight>
  ): ExprRef<boolean> {
    let predicate: ExprRef<boolean> | undefined;

    for (const name of names) {
      const next = eq(
        left[name as keyof typeof left] as ExprRef<any>,
        right[name as keyof typeof right] as ExprRef<any>
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
) => ExprRef<boolean>;
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
  ): ExprRef<boolean> {
    let predicate: ExprRef<boolean> | undefined;

    for (const [leftName, rightName] of Object.entries(mapping) as Array<[LeftKey, RightKey]>) {
      const next = eq(
        left[leftName as keyof typeof left] as ExprRef<any>,
        right[rightName as unknown as keyof typeof right] as ExprRef<any>
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

export type JoinColumnMergerForType<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TType extends JoinKind,
  TSelection extends JoinSelection,
> = JoinColumnMerger<
  JoinLeftColumnsForType<TLeft, TType>,
  JoinRightColumnsForType<TRight, TType>,
  TSelection
>;

export function resolveJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TSelection extends JoinSelection,
>(
  leftColumns: ColumnRefs<TLeft>,
  rightColumns: ColumnRefs<TRight>,
  leftNames: readonly string[],
  rightNames: readonly string[],
  joinType: JoinType,
  mergeColumns?: JoinColumnMerger<Record<string, any>, Record<string, any>, TSelection>
): { mergedColumns: TSelection; nextNames: readonly string[] } {
  if (!mergeColumns) {
    const overlapping = getOverlappingColumnNames(leftNames, rightNames);
    if (overlapping.length > 0) {
      userError(
        "JOIN_OVERLAPPING_COLUMNS",
        `join() requires an explicit merge strategy for overlapping columns: ${overlapping.join(", ")}`
      );
    }
  }
  const mergeResolver =
    (mergeColumns ?? defaultJoinColumnMerger) as JoinColumnMerger<
      Record<string, any>,
      Record<string, any>,
      TSelection
    >;
  const mergeLeftColumns =
    joinType === "RIGHT" || joinType === "FULL"
      ? (leftColumns as unknown as ColumnRefs<NullableColumns<TLeft>>)
      : leftColumns;
  const mergeRightColumns =
    joinType === "LEFT" || joinType === "FULL"
      ? (rightColumns as unknown as ColumnRefs<NullableColumns<TRight>>)
      : rightColumns;
  const mergedColumns = mergeResolver(
    mergeLeftColumns as unknown as ColumnRefs<Record<string, any>>,
    mergeRightColumns as unknown as ColumnRefs<Record<string, any>>
  );
  return {
    mergedColumns,
    nextNames: resolveMergedColumnNames(mergedColumns, leftNames, rightNames),
  };
}

function defaultJoinColumnMerger<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>
>(left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>): ExprRefs<TLeft & TRight> {
  return { ...left, ...right } as ExprRefs<TLeft & TRight>;
}

function resolveMergedColumnNames(
  columns: JoinSelection,
  left: readonly string[],
  right: readonly string[]
): readonly string[] {
  const merged = Object.keys(columns);
  if (merged.length) return merged;
  return mergeColumnNames(left, right);
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
  value: ExprRef<unknown>
): void {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    userError("JOIN_MERGE_CONFLICT", `join merge helper still overlaps after renaming: ${key}`);
  }
  target[key] = value;
}
