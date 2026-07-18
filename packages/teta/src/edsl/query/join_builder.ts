import type { ColumnRefs, Exprs } from "../expr.ts";
import { userError } from "../errors.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import {
  assertCurriedInvocation,
  assertQueryOrCallbackOperand,
  assertRowCallback,
} from "./invocation.ts";
import type {
  CanonicalJoinType,
  JoinKind,
  JoinColumnMergerForType,
  JoinColumnsForType,
  JoinOn,
  JoinOnNoMerge,
  JoinOptions,
  JoinSelection,
  JoinSelectionResult,
  JoinSpecWithSelect,
  JoinSpecWithoutSelect,
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
> = JoinColumnMergerForType<TLeft, TRight, TType, TSelection>;

type JoinConfigWithoutSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind | undefined,
> = JoinOptions<TType> & {
  on: JoinOnNoMerge<TLeft, TRight>;
  select?: undefined;
};

type JoinConfigWithSelect<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind | undefined,
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

export type JoinSpecOptions = {
  readonly lateral?: boolean;
};

export type JoinSpecBuilder<TType extends JoinKind> = {
  <
    TLeft extends QueryColumns,
    TRight extends QueryColumns,
  >(
    on: JoinOnNoMerge<TLeft, TRight>,
    options?: JoinSpecOptions,
  ): JoinSpecWithoutSelect<TLeft, TRight, TType>;
  <
    TLeft extends QueryColumns,
    TRight extends QueryColumns,
    const TSelection extends Record<string, unknown> = JoinSelection,
  >(
    on: JoinOn<TLeft, TRight>,
    select: JoinSpecMerger<TLeft, TRight, TType, TSelection>,
    options?: JoinSpecOptions,
  ): JoinSpecWithSelect<TLeft, TRight, TType, JoinSpecSelection<TSelection>>;
};

type JoinSpecSelection<TSelection extends Record<string, unknown>> =
  TSelection extends { __teta_join_merge_conflict__: infer TConflict }
    ? [TConflict] extends [never]
      ? Extract<TSelection, JoinSelection>
      : never
    : Extract<TSelection, JoinSelection>;

type JoinSpecMerger<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind,
  TSelection extends Record<string, unknown>,
> = JoinColumnMergerForType<TLeft, TRight, TType, JoinSelection> extends (
  left: infer TMergeLeft,
  right: infer TMergeRight,
) => unknown
  ? (left: TMergeLeft, right: TMergeRight) => JoinSpecSelection<TSelection>
  : never;

/**
 * Builds join specifications consumed by `join`.
 */
export const inner: JoinSpecBuilder<"inner"> = createJoinSpecBuilder("inner");
export const left: JoinSpecBuilder<"left"> = createJoinSpecBuilder("left");
export const right: JoinSpecBuilder<"right"> = createJoinSpecBuilder("right");
export const full: JoinSpecBuilder<"full"> = createJoinSpecBuilder("full");

function createJoinSpecBuilder<TType extends JoinKind>(type: TType): JoinSpecBuilder<TType> {
  function build(...args: unknown[]): unknown {
    const usage = `${type}(on, select?, options?)`;
    assertCurriedInvocation(type, usage, args, 1, 3);

    const [on, selectOrOptions, trailingOptions] = args;
    assertRowCallback(type, on);

    let select: ((...args: any[]) => unknown) | undefined;
    let options: unknown;
    if (typeof selectOrOptions === "function") {
      select = selectOrOptions as (...args: any[]) => unknown;
      options = trailingOptions;
    } else {
      if (args.length === 3) {
        userError("QUERY_HELPER_INVALID_ARGUMENTS", `${type}() expects ${usage}`);
      }
      options = selectOrOptions;
    }
    assertJoinSpecOptions(type, options);

    const spec: Record<string, unknown> = { type, on };
    if (select !== undefined) spec.select = select;
    if (options?.lateral !== undefined) spec.lateral = options.lateral;
    return Object.freeze(spec);
  }

  return build as JoinSpecBuilder<TType>;
}

function assertJoinSpecOptions(
  helper: JoinKind,
  value: unknown,
): asserts value is JoinSpecOptions | undefined {
  if (value === undefined) return;
  if (!isPlainObject(value) || isQuery(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }
  const keys = Object.keys(value);
  if (
    keys.some((key) => key !== "lateral")
    || (value.lateral !== undefined && typeof value.lateral !== "boolean")
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }
}

function buildJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind | undefined = undefined,
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
      getQueryState(left),
      getQueryState(rightQuery),
      on,
      lateral,
      resolvedOptions.type ?? "inner",
      merge
    )
  );
}

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind | undefined = undefined,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  config: JoinConfigWithoutSelect<TLeft, TRight, TType>
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, CanonicalJoinType<TType>>>;

export function join<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TType extends JoinKind | undefined = undefined,
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
  TType extends JoinKind | undefined = undefined,
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
  return createQueryStep("join", (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, "inner" | "left" | "right" | "full", JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinKind | undefined> | undefined
    ));
}

function parseJoinInvocation(args: unknown[]): ParsedJoinInvocation {
  const usage = "join(right, spec)";
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
  type?: JoinKind;
  on: (...args: any[]) => unknown;
  select?: (...args: any[]) => unknown;
  lateral?: boolean;
} {
  if (!isPlainObject(value) || isQuery(value)) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "join() expects join(right, spec)"
    );
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "type" && key !== "on" && key !== "select" && key !== "lateral")) {
    userError(
      "DEFERRED_INPUT_INVALID",
      "join() spec must be { type?, on, select?, lateral? }"
    );
  }

  if (typeof value.on !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() expects a row callback in spec.on");
  }
  if (value.select !== undefined && typeof value.select !== "function") {
    userError("DEFERRED_INPUT_INVALID", "join() spec.select must be a row callback");
  }
  if (value.type !== undefined && !isJoinTypeInputValue(value.type)) {
    userError("DEFERRED_INPUT_INVALID", "join() spec.type must be inner, left, right, or full");
  }
  if (value.lateral !== undefined && typeof value.lateral !== "boolean") {
    userError("DEFERRED_INPUT_INVALID", "join() spec.lateral must be boolean");
  }
}

function isJoinTypeInputValue(value: unknown): value is JoinKind {
  return value === "inner"
    || value === "left"
    || value === "right"
    || value === "full";
}
