import type { OrderItem } from "../core/types.ts";
import { toExprNode } from "../expr.ts";
import type {
  ColumnRefs,
  Expr,
} from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlBoolean } from "../sql/types.ts";
import type { Query, QueryStep } from "./core.ts";
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

type PredicateInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

function buildFilter<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  predicate: PredicateInput<TColumns>
): Query<TColumns> {
  const resolved = predicate(query.columns);
  return deriveQuery(query, resolveFilterQuery(query, resolved.node));
}

function buildSort<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  selector: SortInput<TColumns>
): Query<TColumns> {
  const next = selector(query.columns);
  const items = Array.isArray(next) ? next : [next];
  return deriveQuery(query, resolveSortQuery(query, items));
}

function buildTake<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return deriveQuery(query, resolveTakeQuery(query, count));
}

function buildUnion<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>,
  kind: "union" | "union all"
): Query<TColumns> {
  return deriveQuery(left, resolveUnionQuery(left, right, kind));
}

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => Expr<SqlBoolean | null>
): QueryStep<TColumns, TColumns>;

export function filter(...args: unknown[]): unknown {
  assertCurriedInvocation("filter", "filter(predicate)", args);
  const [predicate] = args;
  assertRowCallback("filter", predicate);
  return (query: Query<QueryColumns>) =>
    _filter(query, predicate as PredicateInput<QueryColumns>);
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
  return (query) => deriveQuery(query, resolveFilterQuery(query, toExprNode(predicate)));
}

export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort(...args: unknown[]): unknown {
  assertCurriedInvocation("sort", "sort(selector)", args);
  const [selector] = args;
  assertRowCallback("sort", selector);
  return (query: Query<QueryColumns>) =>
    _sort(query, selector as SortInput<QueryColumns>);
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
  return (query: Query<QueryColumns>) => _take(query, count as number);
}

function _take<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  count: number
): Query<TColumns> {
  return buildTake(query, count);
}

export function unionAll<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function unionAll(...args: unknown[]): unknown {
  assertCurriedQueryOperand("unionAll", "unionAll(right)", args);
  const [right] = args;
  return (left: Query<QueryColumns>) => _unionAll(left, right as Query<QueryColumns>);
}

function _unionAll<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union all");
}

export function union<TColumns extends QueryColumns>(right: Query<TColumns>): QueryStep<TColumns, TColumns>;

export function union(...args: unknown[]): unknown {
  assertCurriedQueryOperand("union", "union(right)", args);
  const [right] = args;
  return (left: Query<QueryColumns>) => _union(left, right as Query<QueryColumns>);
}

function _union<TColumns extends QueryColumns>(
  left: Query<TColumns>,
  right: Query<TColumns>
): Query<TColumns> {
  return buildUnion(left, right, "union");
}
