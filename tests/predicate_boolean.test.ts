import { describe, expect, test } from "bun:test";

import type { ExprNode } from "../src/edsl/core/types.ts";
import {
  normalizePredicateExpr,
  splitPredicateConjuncts,
} from "../src/edsl/sql/render/predicate_boolean.ts";

const column = (name: string): ExprNode<unknown> => ({
  kind: "column",
  table: null,
  name,
});

const literal = (value: string | number | boolean | null): ExprNode<unknown> => ({
  kind: "literal",
  value,
});

const equals = (
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprNode<boolean> => ({
  kind: "binary",
  op: "=",
  left,
  right,
});

describe("predicate boolean helpers", () => {
  test("normalizes negated conjunctions with De Morgan expansion", () => {
    const left = equals(column("a"), literal(1));
    const right = equals(column("b"), literal(2));
    const predicate: ExprNode<boolean> = {
      kind: "unary",
      op: "NOT",
      expr: {
        kind: "group",
        expr: {
          kind: "binary",
          op: "AND",
          left,
          right,
        },
      },
    };

    expect(normalizePredicateExpr(predicate)).toEqual({
      kind: "binary",
      op: "OR",
      left: {
        kind: "unary",
        op: "NOT",
        expr: left,
      },
      right: {
        kind: "unary",
        op: "NOT",
        expr: right,
      },
    });
  });

  test("splits grouped conjuncts after normalization-friendly flattening", () => {
    const left = equals(column("a"), literal(1));
    const middle = equals(column("b"), literal(2));
    const right = equals(column("c"), literal(3));
    const predicate: ExprNode<boolean> = {
      kind: "binary",
      op: "AND",
      left,
      right: {
        kind: "group",
        expr: {
          kind: "binary",
          op: "AND",
          left: middle,
          right,
        },
      },
    };

    expect(splitPredicateConjuncts(predicate)).toEqual([left, middle, right]);
  });
});
