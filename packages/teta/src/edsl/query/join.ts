import type { JoinType, JoinTypeInput } from "../core/types.ts";
import { mergeColumnNames } from "../expr.ts";
import type { ColumnRefs, ExprRef, ExprRefs } from "../expr.ts";
import { userError } from "../errors.ts";

export type JoinSelection = Record<string, ExprRef<unknown>>;

export type JoinOverlappingColumnNames<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = Extract<keyof TLeft, keyof TRight> & string;

export type JoinNoMergeResult<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TColumns extends Record<string, any>,
> = [JoinOverlappingColumnNames<TLeft, TRight>] extends [never] ? TColumns : never;

export type JoinNoMergeGuard<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
> = [JoinOverlappingColumnNames<TLeft, TRight>] extends [never] ? unknown : never;

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

export type JoinOptions<
  TType extends JoinTypeInput | undefined = undefined,
> = {
  type?: TType;
  lateral?: boolean;
};

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
