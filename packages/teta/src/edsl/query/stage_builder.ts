import type { OrderItem } from "../core/types.ts";
import { toExprNode } from "../expr.ts";
import type {
  ColumnRefs,
  Expr,
} from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlBoolean } from "../sql/types.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import { deriveQuery } from "./derive.ts";
import {
  assertCurriedInvocation,
  assertCurriedQueryOperand,
  assertRowCallback,
} from "./invocation.ts";
import {
  resolveFilterQuery,
  resolveSortQuery,
  resolveTakeQuery,
  resolveUnionQuery,
} from "./transitions.ts";
import type { QueryColumns } from "./types.ts";
import {
  assertExprCallbackResult,
  assertOrderItemCallbackResult,
} from "./callback_validation.ts";

type PredicateInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

function buildFilter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: PredicateInput<TColumns>
): Query<TColumns> {
  const resolved = predicate(query.columns);
  assertExprCallbackResult("filter", resolved);
  return deriveQuery(query, resolveFilterQuery(getQueryState(query), resolved.node));
}

function buildSort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: SortInput<TColumns>
): Query<TColumns> {
  const next = selector(query.columns);
  const items = Array.isArray(next) ? next : [next];
  for (const item of items) {
    assertOrderItemCallbackResult("sort", item);
  }
  return deriveQuery(query, resolveSortQuery(getQueryState(query), items));
}

function buildTake<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return deriveQuery(query, resolveTakeQuery(getQueryState(query), count));
}

function buildUnion<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>,
  kind: "union" | "union all"
): Query<TColumns> {
  return deriveQuery(left, resolveUnionQuery(getQueryState(left), getQueryState(right), kind));
}

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>
): QueryStep<TColumns, TColumns>;

export function filter(...args: unknown[]): unknown {
  assertCurriedInvocation("filter", "filter(predicate)", args);
  const [predicate] = args;
  assertRowCallback("filter", predicate);
  return createQueryStep("filter", (query: Query<QueryColumns>) =>
    _filter(query, predicate as PredicateInput<QueryColumns>));
}

function _filter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: PredicateInput<TColumns>
): Query<TColumns> {
  assertRowCallback("filter", predicate);
  return buildFilter(query, predicate);
}

export function filterResolved<TColumns extends QueryColumns>(
  predicate: Expr<SqlBoolean | null>
): QueryStep<TColumns, TColumns> {
  assertExprCallbackResult("filterResolved", predicate);
  return createQueryStep("filterResolved", (query) =>
    deriveQuery(query, resolveFilterQuery(getQueryState(query), toExprNode(predicate))));
}

export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort(...args: unknown[]): unknown {
  assertCurriedInvocation("sort", "sort(selector)", args);
  const [selector] = args;
  assertRowCallback("sort", selector);
  return createQueryStep("sort", (query: Query<QueryColumns>) =>
    _sort(query, selector as SortInput<QueryColumns>));
}

function _sort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: SortInput<TColumns>
): Query<TColumns> {
  assertRowCallback("sort", selector);
  return buildSort(query, selector);
}

export function take<TColumns extends QueryColumns>(count: number): QueryStep<TColumns, TColumns>;

export function take(...args: unknown[]): unknown {
  assertCurriedInvocation("take", "take(count)", args);
  const [count] = args;
  if (typeof count !== "number") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "take() expects take(count)");
  }
  if (!Number.isInteger(count) || count < 0) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "take() expects a finite non-negative integer count"
    );
  }
  return createQueryStep("take", (query: Query<QueryColumns>) => _take(query, count as number));
}

function _take<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return buildTake(query, count);
}

export function unionAll<TColumns extends QueryColumns>(
  right: Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function unionAll(...args: unknown[]): unknown {
  assertCurriedQueryOperand("unionAll", "unionAll(right)", args);
  const [right] = args;
  return createQueryStep("unionAll", (left: Query<QueryColumns>) =>
    _unionAll(left, right as Query<QueryColumns>));
}

function _unionAll<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union all");
}

export function union<TColumns extends QueryColumns>(
  right: Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function union(...args: unknown[]): unknown {
  assertCurriedQueryOperand("union", "union(right)", args);
  const [right] = args;
  return createQueryStep("union", (left: Query<QueryColumns>) =>
    _union(left, right as Query<QueryColumns>));
}

function _union<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union");
}
