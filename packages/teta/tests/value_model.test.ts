import { describe, expect, test } from "bun:test";
import {
  eq,
  isColumn,
  isExpr,
  lit,
  table,
  t,
  toSql,
  filter,
  pipe,
} from "../mod.ts";
import { toExprNode } from "../src/edsl/expr.ts";

describe("tagged EDSL value model", () => {
  test("creates immutable tagged expressions", () => {
    const expr = lit(1);

    expect(expr.kind).toBe("expr");
    expect(isExpr(expr)).toBe(true);
    expect(isColumn(expr)).toBe(false);
    expect(Object.isFrozen(expr)).toBe(true);
    expect(toExprNode(expr)).toEqual({ kind: "literal", value: 1 });
  });

  test("creates immutable tagged column expressions", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    const id = users.columns.id;

    expect(id.kind).toBe("column");
    expect(isExpr(id)).toBe(true);
    expect(isColumn(id)).toBe(true);
    expect(Object.isFrozen(id)).toBe(true);
    expect(id.name).toBe("id");
  });

  test("rejects malformed expression-like values", () => {
    expect(isExpr({ kind: "expr", node: null })).toBe(false);
    expect(() => toExprNode({ kind: "expr", node: null } as any)).toThrow(
      "Unsupported literal value"
    );
  });

  test("tagged expressions still render through query helpers", () => {
    const users = table("users", {
      id: t.int(),
    });

    const query = pipe(users, filter((user) => eq(user.id, lit(1))));

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id AS id FROM users AS users_0 WHERE users_0.id = 1"
    );
  });
});
