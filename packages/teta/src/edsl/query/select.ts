import {
  isExpr,
  toExprNode,
  type ColumnRef,
  type ColumnRefs,
  type ExprLike,
  type ExprRef,
} from "../expr.ts";
import { userError } from "../errors.ts";
import { createQuery, isQuery } from "./builder.ts";
import type { Query } from "./builder.ts";
import { resolveSelectQuery } from "./mutations.ts";
import type { SelectProjection } from "./planner.ts";
import { resolveDerivedQueryInit } from "./state.ts";
type QueryColumns = Record<string, any>;
type SelectExpr = ExprLike<unknown>;
type SelectValue = SelectExpr | AliasedSelectValue<string, SelectExpr>;
type SelectList = readonly SelectValue[];

const ALIASED_SELECT_VALUE: unique symbol = Symbol("teta.alias");

export type AliasedSelectValue<
  TName extends string,
  TExpr extends SelectExpr,
> = {
  readonly [ALIASED_SELECT_VALUE]: true;
  readonly name: TName;
  readonly expr: TExpr;
};

export function alias<const TName extends string>(
  name: TName
): <TExpr extends SelectExpr>(expr: TExpr) => AliasedSelectValue<TName, TExpr> {
  if (!name.trim()) {
    userError("SELECT_ALIAS_EMPTY", "alias name cannot be empty");
  }
  return (expr) => ({
    [ALIASED_SELECT_VALUE]: true,
    name,
    expr,
  });
}

type UnwrapAliased<TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? TExpr : TItem;

type SelectItemValue<TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? ExprValue<TExpr>
  : TItem extends ExprRef<unknown> ? ExprValue<TItem>
  : TItem extends ColumnRef<unknown, string> ? ExprValue<TItem>
  : never;

type ExprValue<TExpr> =
  TExpr extends ExprRef<infer TValue> ? TValue
  : TExpr extends ColumnRef<infer TValue, string> ? TValue
  : never;

type SelectOutputKey<TItem, TFallback extends string> =
  [TItem] extends [AliasedSelectValue<infer TName, SelectExpr>] ? TName
  : [TItem] extends [{ readonly kind: "column"; readonly name: infer TName extends string }] ? TName
  : TFallback;

type Increment<T extends readonly unknown[]> = [...T, unknown];
type IsPlainSelectedColumn<TItem> =
  [UnwrapAliased<TItem>] extends [{ readonly kind: "column"; readonly name: string }] ? true
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
  TItems extends readonly unknown[],
  TGenerated extends readonly unknown[] = [],
> = TItems extends readonly [infer THead, ...infer TTail]
  ? IsPlainSelectedColumn<THead> extends true
    ? {
        [K in SelectOutputKey<THead, never>]: SelectItemValue<THead>;
      } & SelectResultEntries<TTail, TGenerated>
    : {
        [K in SelectOutputKey<THead, `col_${Increment<TGenerated>["length"]}`>]:
          SelectItemValue<THead>;
      } & SelectResultEntries<TTail, Increment<TGenerated>>
  : {};

type Simplify<T> = {
  [K in keyof T]: T[K];
};

type SelectResult<TItems extends readonly unknown[]> =
  Simplify<SelectResultEntries<TItems>>;

export function select<TColumns extends QueryColumns, const TItems extends SelectList>(
  selector: (cols: ColumnRefs<TColumns>) => TItems
): (
  query: Query<TColumns> & SelectDuplicateOutputGuard<TItems>
) => Query<SelectResult<TItems>>;

export function select(...args: unknown[]): unknown {
  if (isQuery(args[0])) {
    userError(
      "QUERY_HELPER_CURRIED_ONLY",
      "select() is curried-only. Use pipe(query, select(selector))."
    );
  }

  const [selectorOrItems] = args;
  if (typeof selectorOrItems !== "function") {
    userError("SELECT_INVALID_SELECTION", "select() items must be expressions");
  }

  return (query: Query<QueryColumns>) => {
    const rawItems = (selectorOrItems as (cols: ColumnRefs<QueryColumns>) => SelectList)(query.columns);
    const items = normalizeSelectItems(rawItems);
    const projection = items.map((item) => {
      const aliased = isAliasedSelectValue(item);
      const expr = aliased ? item.expr : item;
      return {
        expr: toExprNode(expr),
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
    if (!isExpr(expr)) {
      userError("SELECT_INVALID_SELECTION", "select() items must be expressions");
    }
  }
  return value as SelectList;
}

function isAliasedSelectValue(value: unknown): value is AliasedSelectValue<string, SelectExpr> {
  return value !== null
    && typeof value === "object"
    && (value as { readonly [ALIASED_SELECT_VALUE]?: unknown })[ALIASED_SELECT_VALUE] === true;
}
