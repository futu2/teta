import { describe, expect, test } from "bun:test";
import {
  eq,
  isColumn,
  isExpr,
  isQuery,
  lit,
  param,
  table,
  t,
  toSql,
  filter,
  pipe,
  windowFn,
} from "../mod.ts";
import { toExprNode } from "../src/edsl/expr.ts";

describe("tagged EDSL value model", () => {
  test("creates immutable tagged expressions", () => {
    const expr = lit(1);

    expect(expr.kind).toBe("expr");
    expect(isExpr(expr)).toBe(true);
    expect(isColumn(expr)).toBe(false);
    expect(Object.isFrozen(expr)).toBe(true);
    expect(Object.isFrozen(expr.node)).toBe(true);
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
    expect(Object.isFrozen(id.node)).toBe(true);
    expect(id.name).toBe("id");
  });

  test("creates immutable tagged queries", () => {
    const users = table("users", {
      id: t.int(),
    });

    expect(users.kind).toBe("query");
    expect(isQuery(users)).toBe(true);
    expect(Object.isFrozen(users)).toBe(true);
    expect(Object.isFrozen(users.state)).toBe(true);
    expect(Object.isFrozen(users.source)).toBe(true);
    expect(Object.isFrozen(users.columnNames)).toBe(true);
    expect(users.columnNames).toEqual(["id"]);

    const filtered = pipe(users, filter((user) => eq(user.id, lit(1))));
    expect(Object.isFrozen(filtered.stages)).toBe(true);
    expect(Object.isFrozen(filtered.stages[0])).toBe(true);
  });

  test("rejects malformed expression-like values", () => {
    expect(isExpr({ kind: "expr", node: null })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "bogus" } })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "param", name: null } })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "param", value: undefined, name: null } })).toBe(false);
    expect(isExpr(param(null))).toBe(true);
    expect(() => toExprNode({ kind: "expr", node: null } as any)).toThrow(
      "Unsupported literal value"
    );
    expect(() => toExprNode({ kind: "expr", node: { kind: "bogus" } } as any)).toThrow(
      "Unsupported literal value"
    );
  });

  test("freezes nested expression arrays", () => {
    const window = windowFn("ROW_NUMBER", lit(1));

    expect(Object.isFrozen(window)).toBe(true);
    expect(Object.isFrozen(window.args)).toBe(true);
    expect(Object.isFrozen(window.args[0])).toBe(true);
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

  test("throws when untyped code accesses an unknown callback column", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    expect(() => {
      pipe(
        users,
        filter((row) => eq((row as any).missing, 1))
      );
    }).toThrow("Unknown column 'missing'. Available columns: id, name.");
  });
});
