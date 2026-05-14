import {
  ColumnRef,
  ExprRef,
  resolveDeferredExpr,
  toExprNode,
  type ColumnRefs,
} from "../expr.ts";
import type { SqlNumber } from "../sql/types.ts";
import { userError } from "../errors.ts";
import { Query, createQuery } from "./builder.ts";
import { resolveSelectQuery } from "./mutations.ts";
import type { SelectProjection } from "./planner.ts";
import { resolveDerivedQueryInit } from "./state.ts";
import type {
  ColumnValueForKey,
  ColumnValuesForKeys,
  CurrentDepsOf,
  KnownDeferredCurrentColumnsGuard,
  LiteralDeferredKeys,
  QueryColumns,
  SingleLiteralKey,
} from "./deferred_types.ts";
type SelectExpr = ExprRef<unknown>;
type SelectValue = SelectExpr | AliasedSelectValue<string, SelectExpr>;
type SelectList = readonly SelectValue[];

const ALIASED_SELECT_VALUE: unique symbol = Symbol("teta.alias");

export type AliasedSelectValue<
  TName extends string,
  TExpr extends ExprRef<unknown>,
> = {
  readonly [ALIASED_SELECT_VALUE]: true;
  readonly name: TName;
  readonly expr: TExpr;
};

export function alias<const TName extends string>(
  name: TName
): <TExpr extends ExprRef<unknown>>(expr: TExpr) => AliasedSelectValue<TName, TExpr> {
  if (!name.trim()) {
    userError("SELECT_ALIAS_EMPTY", "alias name cannot be empty");
  }
  return (expr) => ({
    [ALIASED_SELECT_VALUE]: true,
    name,
    expr,
  });
}

type CurrentDeferredComputedValue<TColumns extends QueryColumns, TValue, TExpr> =
  [LiteralDeferredKeys<CurrentDepsOf<TExpr>>] extends [never]
    ? TValue
    : TValue extends number | bigint
      ? Extract<ColumnValuesForKeys<TColumns, LiteralDeferredKeys<CurrentDepsOf<TExpr>>>, SqlNumber>
      : TValue;

type CurrentDeferredExprValue<TColumns extends QueryColumns, TExpr> =
  TExpr extends ExprRef<never>
    ? ColumnValueForKey<TColumns, SingleLiteralKey<CurrentDepsOf<TExpr>>>
    : TExpr extends ExprRef<infer TValue>
      ? CurrentDeferredComputedValue<TColumns, TValue, TExpr>
      : never;

type CurrentDeferredListGuard<
  TColumns extends QueryColumns,
  TItems extends readonly unknown[],
> = TItems extends readonly [infer THead, ...infer TTail]
  ? KnownDeferredCurrentColumnsGuard<TColumns, UnwrapAliased<THead>>
    & CurrentDeferredListGuard<TColumns, TTail>
  : unknown;

type UnwrapAliased<TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? TExpr : TItem;

type SelectItemValue<TColumns extends QueryColumns, TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? CurrentDeferredExprValue<TColumns, TExpr>
  : TItem extends ExprRef<unknown> ? CurrentDeferredExprValue<TColumns, TItem>
  : never;

type SelectOutputKey<TItem, TFallback extends string> =
  TItem extends AliasedSelectValue<infer TName, ExprRef<unknown>> ? TName
  : TItem extends ColumnRef<unknown, infer TName> ? TName
  : TItem extends ExprRef<never>
    ? SingleLiteralKey<CurrentDepsOf<TItem>> extends infer TName extends string
      ? [TName] extends [never]
        ? TFallback
        : TName
      : TFallback
  : TFallback;

type Increment<T extends readonly unknown[]> = [...T, unknown];
type IsPlainSelectedColumn<TItem> =
  UnwrapAliased<TItem> extends ColumnRef<unknown, string> ? true
  : UnwrapAliased<TItem> extends ExprRef<never>
    ? SingleLiteralKey<CurrentDepsOf<UnwrapAliased<TItem>>> extends infer TName extends string
      ? [TName] extends [never]
        ? false
        : true
      : false
  : false;

type SelectOutputKeys<
  TItems extends readonly unknown[],
  TGenerated extends readonly unknown[] = [],
> = TItems extends readonly [infer THead, ...infer TTail]
  ? IsPlainSelectedColumn<THead> extends true
    ? [SelectOutputKey<THead, never>, ...SelectOutputKeys<TTail, TGenerated>]
    : [SelectOutputKey<THead, `col_${Increment<TGenerated>["length"]}`>, ...SelectOutputKeys<TTail, Increment<TGenerated>>]
  : [];

type DuplicateSelectOutputKeys<
  TKeys extends readonly string[],
  TSeen extends string = never,
> = TKeys extends readonly [infer THead extends string, ...infer TTail extends readonly string[]]
  ? THead extends TSeen
    ? THead | DuplicateSelectOutputKeys<TTail, TSeen>
    : DuplicateSelectOutputKeys<TTail, TSeen | THead>
  : never;

type SelectDuplicateOutputGuard<TItems extends readonly unknown[]> =
  [DuplicateSelectOutputKeys<SelectOutputKeys<TItems>>] extends [never]
    ? unknown
    : {
        __teta_duplicate_select_output_columns__: DuplicateSelectOutputKeys<SelectOutputKeys<TItems>>;
      };

type SelectResultEntries<
  TColumns extends QueryColumns,
  TItems extends readonly unknown[],
  TGenerated extends readonly unknown[] = [],
> = TItems extends readonly [infer THead, ...infer TTail]
  ? IsPlainSelectedColumn<THead> extends true
    ? {
        [K in SelectOutputKey<THead, never>]: SelectItemValue<TColumns, THead>;
      } & SelectResultEntries<TColumns, TTail, TGenerated>
    : {
        [K in SelectOutputKey<THead, `col_${Increment<TGenerated>["length"]}`>]:
          SelectItemValue<TColumns, THead>;
      } & SelectResultEntries<TColumns, TTail, Increment<TGenerated>>
  : {};

type Simplify<T> = {
  [K in keyof T]: T[K];
};

type SelectResult<TColumns extends QueryColumns, TItems extends readonly unknown[]> =
  Simplify<SelectResultEntries<TColumns, TItems>>;

export function select<const TItems extends SelectList>(
  items: TItems
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & CurrentDeferredListGuard<NoInfer<TColumns>, TItems>
    & SelectDuplicateOutputGuard<TItems>
) => Query<SelectResult<TColumns, TItems>>;

export function select<TColumns extends QueryColumns, const TItems extends SelectList>(
  selector: (cols: ColumnRefs<TColumns>) => TItems
): (
  query: Query<TColumns> & SelectDuplicateOutputGuard<TItems>
) => Query<SelectResult<TColumns, TItems>>;

export function select(...args: unknown[]): unknown {
  if (args[0] instanceof Query) {
    userError(
      "QUERY_HELPER_CURRIED_ONLY",
      "select() is curried-only. Use pipe(query, select(selector))."
    );
  }

  const [selectorOrItems] = args;
  return (query: Query<QueryColumns>) => {
    const rawItems = typeof selectorOrItems === "function"
      ? (selectorOrItems as (cols: ColumnRefs<QueryColumns>) => SelectList)(query.columns)
      : selectorOrItems;
    const items = normalizeSelectItems(rawItems);
    const projection = items.map((item) => {
      const aliased = isAliasedSelectValue(item);
      const expr = aliased ? item.expr : item;
      const resolved = resolveDeferredExpr(expr, {
        current: {
          label: "current row",
          columns: query.columns as ColumnRefs<QueryColumns>,
          columnNames: query.columnNames,
        },
      });
      return {
        expr: toExprNode(resolved),
        alias: aliased ? item.name : null,
      };
    }) satisfies SelectProjection;

    return createQuery(resolveDerivedQueryInit(query, resolveSelectQuery(query, projection)));
  };
}

function normalizeSelectItems(value: unknown): SelectList {
  if (!Array.isArray(value)) {
    userError("SELECT_INVALID_SELECTION", "select() expects an array of expressions");
  }
  for (const item of value) {
    const expr = isAliasedSelectValue(item) ? item.expr : item;
    if (!(expr instanceof ExprRef)) {
      userError("SELECT_INVALID_SELECTION", "select() items must be expressions");
    }
  }
  return value as SelectList;
}

function isAliasedSelectValue(value: unknown): value is AliasedSelectValue<string, ExprRef<unknown>> {
  return value !== null
    && typeof value === "object"
    && (value as { readonly [ALIASED_SELECT_VALUE]?: unknown })[ALIASED_SELECT_VALUE] === true;
}
