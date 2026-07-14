import { describe, expect, test } from "bun:test";

import { exprToSql, type BinaryOp, type ExprNode } from "../mod.ts";

const column = (name: string): ExprNode<unknown> => ({
  kind: "column",
  table: null,
  name,
});

const binary = (
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprNode<unknown> => ({
  kind: "binary",
  op,
  left,
  right,
});

const a = column("a");
const b = column("b");
const c = column("c");
const d = column("d");

describe("expression renderer parentheses", () => {
  const cases: Array<{
    name: string;
    expr: ExprNode<unknown>;
    expected: string;
  }> = [
    {
      name: "preserves a right-nested subtraction",
      expr: binary("-", a, binary("-", b, c)),
      expected: "a - (b - c)",
    },
    {
      name: "preserves a right-nested operator at the same precedence",
      expr: binary("/", a, binary("*", b, c)),
      expected: "a / (b * c)",
    },
    {
      name: "groups a lower-precedence operand",
      expr: binary("*", a, binary("+", b, c)),
      expected: "a * (b + c)",
    },
    {
      name: "groups a compound NOT operand",
      expr: { kind: "unary", op: "NOT", expr: binary("AND", a, b) },
      expected: "NOT (a AND b)",
    },
    {
      name: "keeps a higher-precedence operand compact",
      expr: binary("+", a, binary("*", b, c)),
      expected: "a + b * c",
    },
    {
      name: "keeps a left-associated subtraction compact",
      expr: binary("-", binary("-", a, b), c),
      expected: "a - b - c",
    },
    {
      name: "preserves a right-nested numeric chain",
      expr: binary("+", a, binary("+", b, c)),
      expected: "a + (b + c)",
    },
    {
      name: "keeps an associative boolean chain compact",
      expr: binary("AND", a, binary("AND", b, c)),
      expected: "a AND b AND c",
    },
    {
      name: "groups nested comparison operators",
      expr: binary("=", binary("=", a, b), c),
      expected: "(a = b) = c",
    },
    {
      name: "keeps BETWEEN bounds in its special AND representation",
      expr: binary("BETWEEN", a, binary("AND", b, c)),
      expected: "a BETWEEN b AND c",
    },
    {
      name: "applies the BETWEEN exception only to its bounds",
      expr: binary(
        "BETWEEN",
        binary("AND", a, b),
        binary("AND", c, d)
      ),
      expected: "(a AND b) BETWEEN c AND d",
    },
    {
      name: "preserves an explicit group even when precedence does not require it",
      expr: binary("+", { kind: "group", expr: binary("*", a, b) }, c),
      expected: "(a * b) + c",
    },
  ];

  for (const { name, expr, expected } of cases) {
    test(name, () => {
      expect(exprToSql(expr, { dialect: "postgresql" })).toBe(expected);
    });
  }
});
