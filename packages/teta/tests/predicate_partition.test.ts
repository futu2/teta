import { describe, expect, test } from "bun:test";

import type { ExprNode } from "../src/edsl/core/types.ts";
import {
  partitionAggregatePredicate,
  partitionWindowPredicate,
} from "../src/edsl/sql/render/predicate.ts";

const column = (name: string): ExprNode<unknown> => ({
  kind: "column",
  table: null,
  name,
});

const literal = (value: string | number | boolean | null): ExprNode<unknown> => ({
  kind: "literal",
  value,
});

const binary = (
  op: "=" | ">" | "AND",
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprNode<any> => ({
  kind: "binary",
  op,
  left,
  right,
});

const sum = (arg: ExprNode<unknown>): ExprNode<number> => ({
  kind: "agg",
  name: "SUM",
  arg,
  distinct: false,
});

const rowNumber = (): ExprNode<number> => ({
  kind: "window",
  name: "ROW_NUMBER",
  args: [],
  partitionBy: null,
  orderBy: null,
});

describe("predicate partition helpers", () => {
  test("splits aggregate and non-aggregate conjuncts", () => {
    const nonAggregate = binary("=", column("user_id"), literal(1));
    const aggregate = binary(">", sum(column("total")), literal(100));
    const predicate = binary("AND", nonAggregate, aggregate);

    expect(partitionAggregatePredicate(predicate)).toEqual({
      aggregate,
      nonAggregate,
    });
  });

  test("splits window and non-window conjuncts while preserving outer window predicate", () => {
    const nonWindow = binary(">", column("total"), literal(10));
    const window = binary("=", rowNumber(), literal(1));
    const predicate = binary("AND", nonWindow, window) as ExprNode<boolean>;

    expect(partitionWindowPredicate(predicate, (expr) => expr)).toEqual({
      window,
      nonWindow,
      outerWindow: window,
    });
  });
});
