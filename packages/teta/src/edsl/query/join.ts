import type { JoinType } from "../core/types.ts";
import { mergeColumnNames } from "../expr.ts";
import type { ColumnRefs, Expr, ExprPhase, Exprs } from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlBoolean } from "../types.ts";
import type { QueryValue } from "./types.ts";

export type JoinSelection = Record<string, Expr<any, ExprPhase>>;

export type JoinOverlappingColumnNames<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
> = Extract<keyof TLeft, keyof TRight> & string;

export type JoinNoMergeGuard<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
> = string extends keyof TLeft ? unknown
  : string extends keyof TRight ? unknown
    : [JoinOverlappingColumnNames<TLeft, TRight>] extends [never] ? unknown
      : {
          __teta_join_overlap_requires_merge__: JoinOverlappingColumnNames<TLeft, TRight>;
        };

export type JoinOn<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
> = (left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>) => Expr<SqlBoolean | null>;

export type JoinOnNoMerge<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
> = JoinOn<TLeft, TRight> & JoinNoMergeGuard<TLeft, TRight>;

export type JoinSelectionResult<TSelection extends JoinSelection> = {
  [K in keyof TSelection]: TSelection[K] extends Expr<infer TValue, ExprPhase>
    ? TValue extends QueryValue
      ? TValue
      : never
    : never;
};

export type JoinColumnMerger<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TSelection extends JoinSelection = Exprs<TLeft & TRight>
> = (
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => TSelection;

type NullableColumns<TColumns extends Record<string, unknown>> = {
  [K in keyof TColumns]: TColumns[K] | null;
};

type LeftJoinColumns<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
> = TLeft & NullableColumns<TRight>;

type RightJoinColumns<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
> = NullableColumns<TLeft> & TRight;

type FullJoinColumns<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
> = NullableColumns<TLeft> & NullableColumns<TRight>;

export type JoinKind = "inner" | "left" | "right" | "full";
type NormalizedJoinKind<TType extends JoinType> =
  TType extends "LEFT" ? "left"
  : TType extends "RIGHT" ? "right"
    : TType extends "FULL" ? "full"
      : "inner";

export type CanonicalJoinType<TType extends JoinKind | undefined> =
  TType extends "left" ? "left"
  : TType extends "right" ? "right"
    : TType extends "full" ? "full"
      : "inner";

export type JoinColumnsForType<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
> = TType extends "left"
  ? LeftJoinColumns<TLeft, TRight>
  : TType extends "right"
    ? RightJoinColumns<TLeft, TRight>
    : TType extends "full"
      ? FullJoinColumns<TLeft, TRight>
      : TLeft & TRight;

type JoinLeftColumnsForType<
  TLeft extends Record<string, unknown>,
  TType extends JoinKind,
> = TType extends "right" | "full" ? NullableColumns<TLeft> : TLeft;

type JoinRightColumnsForType<
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
> = TType extends "left" | "full" ? NullableColumns<TRight> : TRight;

export type JoinOptions<
  TType extends JoinKind | undefined = undefined,
> = {
  type?: TType;
  lateral?: boolean;
};

export type JoinColumnMergerForType<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinKind,
  TSelection extends JoinSelection,
> = JoinColumnMerger<
  JoinLeftColumnsForType<TLeft, TType>,
  JoinRightColumnsForType<TRight, TType>,
  TSelection
>;

export function resolveJoinColumns<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>,
  TType extends JoinType,
  TSelection extends JoinSelection,
>(
  leftRefs: ColumnRefs<TLeft>,
  rightRefs: ColumnRefs<TRight>,
  leftNames: readonly string[],
  rightNames: readonly string[],
  _joinType: TType,
  mergeColumns?: JoinColumnMergerForType<
    TLeft,
    TRight,
    NormalizedJoinKind<TType>,
    TSelection
  >
): { mergedColumns: TSelection; nextNames: readonly string[] } {
  if (!mergeColumns) {
    const overlapping = getOverlappingColumnNames(leftNames, rightNames);
    if (overlapping.length > 0) {
      userError(
        "JOIN_OVERLAPPING_COLUMNS",
        `Join helpers require an explicit merge strategy for overlapping columns: ${overlapping.join(", ")}`
      );
    }
  }
  type TKind = NormalizedJoinKind<TType>;
  type TMergeLeft = JoinLeftColumnsForType<TLeft, TKind>;
  type TMergeRight = JoinRightColumnsForType<TRight, TKind>;
  const mergeResolver = (mergeColumns ?? defaultJoinColumnMerger) as JoinColumnMerger<
    TMergeLeft,
    TMergeRight,
    TSelection
  >;
  const mergedColumns = mergeResolver(
    joinLeftRefs<TLeft, TKind>(leftRefs),
    joinRightRefs<TRight, TKind>(rightRefs)
  );
  return {
    mergedColumns,
    nextNames: resolveMergedColumnNames(mergedColumns, leftNames, rightNames),
  };
}

function joinLeftRefs<
  TLeft extends Record<string, unknown>,
  TKind extends JoinKind,
>(
  leftRefs: ColumnRefs<TLeft>
): ColumnRefs<JoinLeftColumnsForType<TLeft, TKind>> {
  return leftRefs as ColumnRefs<JoinLeftColumnsForType<TLeft, TKind>>;
}

function joinRightRefs<
  TRight extends Record<string, unknown>,
  TKind extends JoinKind,
>(
  rightRefs: ColumnRefs<TRight>
): ColumnRefs<JoinRightColumnsForType<TRight, TKind>> {
  return rightRefs as ColumnRefs<JoinRightColumnsForType<TRight, TKind>>;
}

function defaultJoinColumnMerger<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
>(left: ColumnRefs<TLeft>, right: ColumnRefs<TRight>): Exprs<TLeft & TRight> {
  return { ...left, ...right } as unknown as Exprs<TLeft & TRight>;
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
