import {
  dropInternal,
  extendInternal,
  filterInternal,
  type InternalExtendedColumns,
} from "../helpers/projection.ts";
import { isExpr, lte, over, rowNumber } from "../expr.ts";
import type { OrderItem } from "../core/types.ts";
import type { ColumnRefs, Expr } from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlInt } from "../sql/types.ts";
import { createQueryStep, getQueryState, type Query, type QueryStep } from "./core.ts";
import type { QueryColumns } from "./types.ts";

export type TakeWithinSpec<TColumns extends QueryColumns> = {
  partitionBy: (cols: ColumnRefs<TColumns>) => Expr<unknown> | Expr<unknown>[];
  orderBy: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];
  count: number;
};

const TAKE_WITHIN_ROW_NUMBER = "__teta_take_within_row_number";

export function takeWithin<TColumns extends QueryColumns>(
  spec: TakeWithinSpec<TColumns>
): QueryStep<TColumns, TColumns> {
  if (typeof spec !== "object" || spec === null) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "takeWithin() expects takeWithin(spec)");
  }
  if (typeof spec.partitionBy !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "takeWithin() expects a partitionBy row callback");
  }
  if (typeof spec.orderBy !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "takeWithin() expects an orderBy row callback");
  }
  if (!Number.isInteger(spec.count) || spec.count < 0) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      "takeWithin() expects a finite non-negative integer count"
    );
  }

  return createQueryStep("takeWithin", (query) => {
    if (getQueryState(query).columnNames.includes(TAKE_WITHIN_ROW_NUMBER)) {
      userError(
        "QUERY_HELPER_INVALID_ARGUMENTS",
        `takeWithin() cannot use reserved helper column '${TAKE_WITHIN_ROW_NUMBER}'`
      );
    }

    type NumberedColumns = InternalExtendedColumns<
      TColumns,
      typeof TAKE_WITHIN_ROW_NUMBER,
      SqlInt
    >;

    const numbered = extendInternal<TColumns, typeof TAKE_WITHIN_ROW_NUMBER, Expr<SqlInt>>(
      TAKE_WITHIN_ROW_NUMBER,
      (cols: ColumnRefs<TColumns>) => {
        const partitionBy = resolvePartitionBy(cols, spec.partitionBy);
        const orderBy = resolveOrderBy(cols, spec.orderBy);
        return over(rowNumber(), { partitionBy, orderBy });
      }
    )(query);

    const numberedColumns = numbered.columns as ColumnRefs<Record<
      typeof TAKE_WITHIN_ROW_NUMBER,
      SqlInt
    >>;
    const limited = filterInternal<NumberedColumns>(
      numbered,
      lte(numberedColumns[TAKE_WITHIN_ROW_NUMBER], spec.count)
    );

    return dropTakeWithinRowNumber(limited);
  });
}

function dropTakeWithinRowNumber<TColumns extends QueryColumns>(
  query: Query<InternalExtendedColumns<TColumns, typeof TAKE_WITHIN_ROW_NUMBER, SqlInt>>
): Query<TColumns> {
  return dropInternal(query, [TAKE_WITHIN_ROW_NUMBER] as const) as unknown as Query<TColumns>;
}

function resolvePartitionBy<TColumns extends QueryColumns>(
  cols: ColumnRefs<TColumns>,
  selector: TakeWithinSpec<TColumns>["partitionBy"]
): Expr<unknown> | Expr<unknown>[] {
  const value = selector(cols);
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    assertExprResult("takeWithin.partitionBy", item);
  }
  return value;
}

function resolveOrderBy<TColumns extends QueryColumns>(
  cols: ColumnRefs<TColumns>,
  selector: TakeWithinSpec<TColumns>["orderBy"]
): OrderItem | OrderItem[] {
  const value = selector(cols);
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    assertOrderItemResult("takeWithin.orderBy", item);
  }
  return value;
}

function assertExprResult(helper: string, value: unknown): asserts value is Expr<unknown> {
  if (!isExpr(value)) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return expression(s)`);
  }
}

function assertOrderItemResult(helper: string, value: unknown): asserts value is OrderItem {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || !isExpr({ kind: "expr", node: (value as { expr?: unknown }).expr })
  ) {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return order item(s)`);
  }
  const direction = (value as { direction?: unknown }).direction;
  if (direction !== "ASC" && direction !== "DESC") {
    userError("DEFERRED_INPUT_INVALID", `${helper}() callback must return order item(s)`);
  }
}
