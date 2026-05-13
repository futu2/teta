import {
  ColumnRef,
  ExprRef,
  resolveDeferredExpr,
  toExprNode,
  type ColumnRefs,
  type DeferredExprDepsOf,
} from "../expr.ts";
import type { SqlNumber } from "../sql/types.ts";
import { userError } from "../errors.ts";
import { Query, createQuery } from "./builder.ts";
import type { QueryStep } from "./builder.ts";
import { resolveSelectQuery } from "./mutations.ts";
import type { SelectProjection } from "./planner.ts";
import { resolveDerivedQueryInit } from "./state.ts";

type QueryColumns = Record<string, any>;
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

type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LeftDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { left?: infer TLeft }
  ? TLeft
  : Record<never, never>;

type RightDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { right?: infer TRight }
  ? TRight
  : Record<never, never>;

type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

type SingleLiteralKey<TDeps> = LiteralDeferredKeys<TDeps> extends infer TKey extends string
  ? [TKey] extends [never]
    ? never
    : TKey
  : never;

type ColumnValueForKey<TColumns extends QueryColumns, TKey> =
  [TKey] extends [never]
    ? never
    : TKey extends keyof TColumns
      ? TColumns[TKey & keyof TColumns]
      : never;

type ColumnValuesForKeys<TColumns extends QueryColumns, TKeys> =
  TKeys extends keyof TColumns ? TColumns[TKeys] : never;

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

type KnownDeferredCurrentColumnsGuard<
  TColumns extends QueryColumns,
  TExpr,
> = ([Exclude<LiteralDeferredKeys<CurrentDepsOf<TExpr>>, keyof TColumns>] extends [never]
    ? unknown
    : {
        __teta_unknown_deferred_current_columns__: Exclude<
          LiteralDeferredKeys<CurrentDepsOf<TExpr>>,
          keyof TColumns
        >;
      })
  & ([LiteralDeferredKeys<LeftDepsOf<TExpr>> | LiteralDeferredKeys<RightDepsOf<TExpr>>] extends [never]
    ? unknown
    : {
        __teta_invalid_deferred_current_scope_columns__:
          | LiteralDeferredKeys<LeftDepsOf<TExpr>>
          | LiteralDeferredKeys<RightDepsOf<TExpr>>;
      });

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

type CurrentDeferredListGuard<
  TColumns extends QueryColumns,
  TItems extends readonly unknown[],
> = UnionToIntersection<{
  [K in keyof TItems]: KnownDeferredCurrentColumnsGuard<TColumns, UnwrapAliased<TItems[K]>>;
}[number]>;

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
  query: Query<TColumns> & CurrentDeferredListGuard<NoInfer<TColumns>, TItems>
) => Query<SelectResult<TColumns, TItems>>;

export function select<TColumns extends QueryColumns, const TItems extends SelectList>(
  selector: (cols: ColumnRefs<TColumns>) => TItems
): QueryStep<TColumns, SelectResult<TColumns, TItems>>;

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
