import { isExpr, type ColumnRefs, type Expr } from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlInt } from "../sql/types.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import { assertRowCallback } from "./invocation.ts";
import { resolveUnnestQuery } from "./transitions.ts";
import type { QueryColumns } from "./types.ts";

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

type UnnestSelection<
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
> = {
  value: TValueName;
  ordinality?: TOrdinalityName;
};

type UnnestOptions<TOuter extends boolean | undefined = undefined> = {
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
  return createQueryStep("unnest", (left: Query<QueryColumns>) =>
    buildUnnest(
      left,
      selector as UnnestSelectorInput<QueryColumns, readonly unknown[] | unknown[] | null>,
      selection as UnnestSelection<string, string | undefined>,
      options as UnnestOptions<boolean | undefined> | undefined
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
  const collection = selector(left.columns);
  assertExprResult("unnest", collection);
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
}

function assertExprResult(helper: string, value: unknown): asserts value is Expr<unknown> {
  if (!isExpr(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return an expression`);
  }
}
