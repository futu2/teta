import { join } from "../query/builder.ts";
import type {
  JoinRightInput,
  QueryStep,
} from "../query/builder.ts";
import type {
  ColumnRefs,
  Exprs,
} from "../expr.ts";
import type {
  JoinColumnMergerForType,
  JoinColumnsForType,
  JoinOn,
  JoinOnNoMerge,
  JoinSelection,
  JoinSelectionResult,
} from "../query/join.ts";
import { isQuery } from "../query/builder.ts";
import { userError } from "../errors.ts";

type QueryColumns = Record<string, any>;
type FixedJoinType = "inner" | "left" | "right" | "full";

type FixedJoinOptions = {
  lateral?: boolean;
};

type ParsedFixedJoinInvocation = {
  right: unknown;
  on: unknown;
  select: unknown;
  options: unknown;
};

export function innerJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "inner">>;

export function innerJoin(...args: unknown[]): unknown {
  return fixedJoin(args, "inner");
}

export function innerJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function innerJoinMap(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "inner", "innerJoinMap");
}

export function innerJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "inner", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function innerJoinMerge(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "inner", "innerJoinMerge");
}

export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "left">>;

export function leftJoin(...args: unknown[]): unknown {
  return fixedJoin(args, "left");
}

export function leftJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function leftJoinMap(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "left", "leftJoinMap");
}

export function leftJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function leftJoinMerge(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "left", "leftJoinMerge");
}

export function rightJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "right">>;

export function rightJoin(...args: unknown[]): unknown {
  return fixedJoin(args, "right");
}

export function rightJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function rightJoinMap(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "right", "rightJoinMap");
}

export function rightJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "right", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function rightJoinMerge(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "right", "rightJoinMerge");
}

export function fullJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "full">>;

export function fullJoin(...args: unknown[]): unknown {
  return fixedJoin(args, "full");
}

export function fullJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function fullJoinMap(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "full", "fullJoinMap");
}

export function fullJoinMerge<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection = JoinSelection,
>(
  right: JoinRightInput<TLeft, TRight>,
  on: JoinOn<TLeft, TRight>,
  merge: JoinColumnMergerForType<TLeft, TRight, "full", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;

export function fullJoinMerge(...args: unknown[]): unknown {
  return fixedJoinSelect(args, "full", "fullJoinMerge");
}

function fixedJoin(args: unknown[], type: FixedJoinType): unknown {
  const helper = fixedJoinHelperName(type);
  const parsed = parseFixedJoinInvocation(args, helper);
  return join(
    parsed.right as JoinRightInput<QueryColumns, QueryColumns>,
    {
      ...(parsed.options as FixedJoinOptions | undefined),
      type,
      on: parsed.on as JoinOnNoMerge<QueryColumns, QueryColumns>,
    }
  );
}

function fixedJoinSelect(
  args: unknown[],
  type: FixedJoinType,
  helper: string
): unknown {
  const parsed = parseFixedJoinSelectInvocation(args, helper);
  return join(
    parsed.right as JoinRightInput<QueryColumns, QueryColumns>,
    {
      type,
      on: parsed.on as JoinOn<QueryColumns, QueryColumns>,
      select: parsed.select as JoinColumnMergerForType<
        QueryColumns,
        QueryColumns,
        typeof type,
        Exprs<QueryColumns>
      >,
    }
  );
}

function parseFixedJoinInvocation(
  args: unknown[],
  helper: string
): ParsedFixedJoinInvocation {
  if (args.length !== 2 && args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, options?)`);
  }
  const [right, on, options] = args;
  assertJoinRight(helper, right, `${helper}(right, on, options?)`);
  assertRowCallback(helper, on);
  assertFixedJoinOptions(helper, options);
  return { right, on, select: undefined, options };
}

function parseFixedJoinSelectInvocation(
  args: unknown[],
  helper: string
): ParsedFixedJoinInvocation {
  if (args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, selector)`);
  }
  const [right, on, select] = args;
  assertJoinRight(helper, right, `${helper}(right, on, selector)`);
  assertRowCallback(helper, on);
  assertRowCallback(helper, select);
  return { right, on, select, options: undefined };
}

function assertJoinRight(helper: string, value: unknown, usage: string): void {
  if (!isQuery(value) && typeof value !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

function assertRowCallback(helper: string, value: unknown): asserts value is (...args: any[]) => unknown {
  if (typeof value !== "function") {
    userError("DEFERRED_INPUT_INVALID", `${helper}() expects a row callback`);
  }
}

function assertFixedJoinOptions(helper: string, value: unknown): void {
  if (value === undefined) return;
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || isQuery(value)
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }

  const options = value as Record<string, unknown>;
  const keys = Object.keys(options);
  if (
    keys.some((key) => key !== "lateral")
    || ("lateral" in options && typeof options.lateral !== "boolean")
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() options must be { lateral?: boolean }`);
  }
}

function fixedJoinHelperName(type: FixedJoinType): string {
  switch (type) {
    case "inner":
      return "innerJoin";
    case "left":
      return "leftJoin";
    case "right":
      return "rightJoin";
    case "full":
      return "fullJoin";
  }
}
