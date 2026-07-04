import type { JoinTypeInput } from "../core/types.ts";
import type { ColumnRefs, Exprs } from "../expr.ts";
import { userError } from "../errors.ts";
import type { Query, QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import {
  assertQueryOrCallbackOperand,
  assertRowCallback,
} from "./invocation.ts";
import type {
  CanonicalJoinType,
  JoinColumnMergerForType,
  JoinColumnsForType,
  JoinOn,
  JoinOnNoMerge,
  JoinOptions,
  JoinSelection,
  JoinSelectionResult,
} from "./join.ts";
import { resolveJoinQuery } from "./transitions.ts";
import type { QueryColumns } from "./types.ts";
import { qualifyOuterColumns } from "./utils.ts";
import { isPlainObject, isQuery } from "./value.ts";

type JoinOnInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
> = JoinOn<TLeft, TRight>;

type JoinMergeInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends "inner" | "left" | "right" | "full",
  TSelection extends JoinSelection,
> =
  | JoinColumnMergerForType<TLeft, TRight, TType, TSelection>
  | TSelection;

type JoinConfigWithoutSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined,
> = JoinOptions<TType> & {
  on: JoinOnNoMerge<TLeft, TRight>;
  select?: undefined;
};

type JoinConfigWithSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined,
  TSelection extends JoinSelection,
> = JoinOptions<TType> & {
  on: JoinOnInput<TLeft, TRight>;
  select: JoinColumnMergerForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >;
};

export type JoinRightInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
> = Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>);

function buildJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TSelection extends JoinSelection = Exprs<JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >>,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge?: JoinMergeInput<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>> {
  const outerColumns = qualifyOuterColumns(left.columns);
  const resolvedOptions = options ?? {};
  const lateral = typeof right === "function" || resolvedOptions.lateral === true;
  const rightQuery = typeof right === "function" ? right(outerColumns) : right;
  return deriveQuery(
    left,
    resolveJoinQuery(
      left,
      rightQuery,
      on,
      lateral,
      resolvedOptions.type ?? "inner",
      merge as JoinMergeInput<QueryColumns, QueryColumns, CanonicalJoinType<TType>, TSelection> | undefined
    )
  );
}

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  config: JoinConfigWithoutSelect<TLeft, TRight, TType>
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, CanonicalJoinType<TType>>>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  config: JoinConfigWithSelect<TLeft, TRight, TType, TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function join(...args: unknown[]): unknown {
  const parsed = parseJoinInvocation(args);
  return buildJoinStep(parsed);
}

function _join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinTypeInput | undefined = undefined,
  TSelection extends JoinSelection = Exprs<JoinColumnsForType<
    TLeft,
    TRight,
    CanonicalJoinType<TType>
  >>,
>(
  left: Query<TLeft>,
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  merge?: JoinMergeInput<
    TLeft,
    TRight,
    CanonicalJoinType<TType>,
    TSelection
  >,
  options?: JoinOptions<TType>
): Query<JoinSelectionResult<TSelection>> {
  assertRowCallback("join", on);
  return buildJoin(left, right, on, merge, options);
}

type ParsedCurriedJoinInvocation = {
  right: unknown;
  on: unknown;
  merge: unknown;
  options: unknown;
};

type ParsedJoinInvocation = ParsedCurriedJoinInvocation;

function buildJoinStep(parsed: ParsedJoinInvocation): QueryStep<QueryColumns, QueryColumns> {
  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, "inner" | "left" | "right" | "full", JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinTypeInput | undefined> | undefined
    );
}

function parseJoinInvocation(args: unknown[]): ParsedJoinInvocation {
  const usage = "join(right, { type?, on, select?, lateral? })";
  if (args.length !== 2) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `join() expects ${usage}`);
  }

  const [right, config] = args;
  assertQueryOrCallbackOperand("join", right, usage);
  assertJoinConfig(config);

  return {
    right,
    on: config.on,
    merge: config.select,
    options: {
      type: config.type,
      lateral: config.lateral,
    },
  };
}

function assertJoinConfig(value: unknown): asserts value is {
  type?: JoinTypeInput;
  on: (...args: any[]) => unknown;
  select?: (...args: any[]) => unknown;
  lateral?: boolean;
} {
  if (!isPlainObject(value) || isQuery(value)) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "join() expects join(right, { type?, on, select?, lateral? })"
    );
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "type" && key !== "on" && key !== "select" && key !== "lateral")) {
    userError(
      "DEFERRED_INPUT_INVALID",
      "join() options must be { type?, on, select?, lateral? }"
    );
  }

  if (typeof value.on !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() expects a row callback in options.on");
  }
  if (value.select !== undefined && typeof value.select !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() options.select must be a row callback");
  }
  if (value.type !== undefined && !isJoinTypeInputValue(value.type)) {
    userError("DEFERRED_INPUT_INVALID", "join() options.type must be inner, left, right, or full");
  }
  if (value.lateral !== undefined && typeof value.lateral !== "boolean") {
    userError("DEFERRED_INPUT_INVALID", "join() options.lateral must be boolean");
  }
}

function isJoinTypeInputValue(value: unknown): value is JoinTypeInput {
  return value === "inner"
    || value === "left"
    || value === "right"
    || value === "full"
    || value === "INNER"
    || value === "LEFT"
    || value === "RIGHT"
    || value === "FULL";
}
