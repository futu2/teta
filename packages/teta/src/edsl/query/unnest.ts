import type { ColumnRefs, Expr } from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlInt } from "../sql/types.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import { assertRowCallback } from "./invocation.ts";
import { resolveUnnestQuery } from "./transitions.ts";
import type { QueryColumns } from "./types.ts";
import { isPlainObject } from "./value.ts";
import { assertExprCallbackResult } from "./callback_validation.ts";

type UnnestSelectorInput<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
> = (cols: ColumnRefs<TLeft>) => Expr<TCollection>;

type CollectionItem<TCollection> =
  NonNullable<TCollection> extends readonly (infer TItem)[] ? TItem
  : NonNullable<TCollection> extends (infer TItem)[] ? TItem
  : never;

type MaybeOuter<TValue, TOuter extends boolean | undefined> =
  TOuter extends true ? TValue | null
  : TValue;

export type UnnestSelection<
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
> = {
  value: TValueName;
  ordinality?: TOrdinalityName;
};

export type UnnestOptions<TOuter extends boolean | undefined = undefined> = {
  outer?: TOuter;
};

type UnnestGeneratedColumns<
  TItem,
  TValueName extends string,
  TOrdinalityName extends string | undefined,
  TOuter extends boolean | undefined,
> = {
  [K in TValueName]: MaybeOuter<TItem, TOuter>;
} & (TOrdinalityName extends string
  ? { [K in TOrdinalityName]: MaybeOuter<SqlInt, TOuter> }
  : {});

export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  selector: (cols: ColumnRefs<TLeft>) => Expr<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options?: UnnestOptions<TOuter>
): QueryStep<
  TLeft,
  TLeft & UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >
>;

export function unnest(...args: unknown[]): unknown {
  assertUnnestInvocation(args);
  const [selector, selection, options] = args;
  const selectionSnapshot = {
    value: (selection as UnnestSelection<string, string | undefined>).value,
    ordinality: (selection as UnnestSelection<string, string | undefined>).ordinality,
  };
  const optionsSnapshot = options === undefined
    ? undefined
    : { outer: (options as UnnestOptions<boolean | undefined>).outer };
  return createQueryStep("unnest", (left: Query<QueryColumns>) =>
    buildUnnest(
      left,
      selector as UnnestSelectorInput<QueryColumns, readonly unknown[] | unknown[] | null>,
      selectionSnapshot,
      optionsSnapshot
    ));
}

function buildUnnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
  TGenerated extends QueryColumns = UnnestGeneratedColumns<
    CollectionItem<TCollection>,
    TValueName,
    TOrdinalityName,
    TOuter
  >,
>(
  left: Query<TLeft>,
  selector: UnnestSelectorInput<TLeft, TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options: UnnestOptions<TOuter> = {}
): Query<TLeft & TGenerated> {
  assertRowCallback("unnest", selector);
  assertUnnestSelection(selection);
  assertUnnestOptions(options);
  const collection = selector(left.columns);
  assertExprCallbackResult("unnest", collection);
  return deriveQuery(
    left,
    resolveUnnestQuery<TLeft, TGenerated>(
      getQueryState(left),
      collection,
      selection,
      options
    )
  );
}

function assertUnnestInvocation(args: unknown[]): void {
  if (args.length < 2 || args.length > 3) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "unnest() expects unnest(selector, selection, options?)"
    );
  }
  assertRowCallback("unnest", args[0]);
  assertUnnestSelection(args[1]);
  if (args.length === 3) assertUnnestOptions(args[2]);
}

function assertUnnestSelection(
  value: unknown
): asserts value is UnnestSelection<string, string | undefined> {
  if (!isPlainObject(value)) {
    userError(
      "DEFERRED_INPUT_INVALID",
      "unnest() selection must be { value: string, ordinality?: string }"
    );
  }

  const keys = Object.keys(value);
  if (keys.some((key) => key !== "value" && key !== "ordinality")) {
    userError(
      "DEFERRED_INPUT_INVALID",
      "unnest() selection must be { value: string, ordinality?: string }"
    );
  }
  if (typeof value.value !== "string" || value.value.length === 0) {
    userError("DEFERRED_INPUT_INVALID", "unnest() selection.value must be a non-empty string");
  }
  if (
    value.ordinality !== undefined
    && (typeof value.ordinality !== "string" || value.ordinality.length === 0)
  ) {
    userError("DEFERRED_INPUT_INVALID", "unnest() selection.ordinality must be a non-empty string");
  }
  if (value.ordinality === value.value) {
    userError("DEFERRED_INPUT_INVALID", "unnest() selection column names must be distinct");
  }
}

function assertUnnestOptions(
  value: unknown
): asserts value is UnnestOptions<boolean | undefined> {
  if (value === undefined) return;
  if (!isPlainObject(value)) {
    userError("DEFERRED_INPUT_INVALID", "unnest() options must be { outer?: boolean }");
  }

  const keys = Object.keys(value);
  if (
    keys.some((key) => key !== "outer")
    || (value.outer !== undefined && typeof value.outer !== "boolean")
  ) {
    userError("DEFERRED_INPUT_INVALID", "unnest() options must be { outer?: boolean }");
  }
}
