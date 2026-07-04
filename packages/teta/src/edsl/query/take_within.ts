import { drop, extendInternal } from "../helpers/projection.ts";
import { lte, over, rowNumber } from "../expr.ts";
import type { ColumnRefs, Expr, WindowSpecInput } from "../expr.ts";
import { userError } from "../errors.ts";
import type { SqlInt } from "../sql/types.ts";
import { createQueryStep, getQueryState, type QueryStep } from "./core.ts";
import { filter } from "./stage_builder.ts";
import type { QueryColumns } from "./types.ts";

export type TakeWithinSpec<TColumns extends QueryColumns> = {
  partitionBy: (cols: ColumnRefs<TColumns>) => Expr<unknown> | Expr<unknown>[];
  orderBy: (cols: ColumnRefs<TColumns>) => NonNullable<WindowSpecInput["orderBy"]>;
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

    const numbered = extendInternal<TColumns, typeof TAKE_WITHIN_ROW_NUMBER, Expr<SqlInt>>(
      TAKE_WITHIN_ROW_NUMBER,
      (cols: ColumnRefs<TColumns>) =>
        over(rowNumber(), {
          partitionBy: spec.partitionBy(cols),
          orderBy: spec.orderBy(cols),
        })
    )(query);

    const limited = filter((cols: ColumnRefs<QueryColumns>) => {
      const numberedCols = cols as Record<typeof TAKE_WITHIN_ROW_NUMBER, Expr<SqlInt>>;
      return lte(numberedCols[TAKE_WITHIN_ROW_NUMBER], spec.count);
    })(numbered as any) as any;

    return (drop(TAKE_WITHIN_ROW_NUMBER) as QueryStep<QueryColumns, QueryColumns>)(limited) as any;
  });
}
