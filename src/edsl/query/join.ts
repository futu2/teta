import type { JoinType, JoinTypeInput } from "../core/types";
import { mergeColumnNames } from "../expr";
import type { ColumnRefs, ExprRefs } from "../expr";

export type JoinColumnMerger<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TMerged extends Record<string, any> = TLeft & TRight
> = (
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRefs<TMerged>;

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
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TType extends JoinTypeInput | undefined = undefined,
  TMerged extends Record<string, any> = JoinColumnsForType<TLeft, TRight, CanonicalJoinType<TType>>,
> = {
  type?: TType;
  lateral?: boolean;
  merge?: JoinColumnMerger<
    JoinLeftColumnsForType<TLeft, CanonicalJoinType<TType>>,
    JoinRightColumnsForType<TRight, CanonicalJoinType<TType>>,
    TMerged
  >;
};

export function resolveJoinColumns<
  TLeft extends Record<string, any>,
  TRight extends Record<string, any>,
  TMerged extends Record<string, any>,
>(
  leftColumns: ColumnRefs<TLeft>,
  rightColumns: ColumnRefs<TRight>,
  leftNames: readonly string[],
  rightNames: readonly string[],
  joinType: JoinType,
  mergeColumns?: JoinColumnMerger<Record<string, any>, Record<string, any>, TMerged>
): { mergedColumns: ExprRefs<TMerged>; nextNames: readonly string[] } {
  const mergeResolver =
    (mergeColumns ?? defaultJoinColumnMerger) as JoinColumnMerger<
      Record<string, any>,
      Record<string, any>,
      TMerged
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

function resolveMergedColumnNames<TColumns extends Record<string, any>>(
  columns: ExprRefs<TColumns>,
  left: readonly string[],
  right: readonly string[]
): readonly string[] {
  const merged = Object.keys(columns);
  if (merged.length) return merged;
  return mergeColumnNames(left, right);
}
