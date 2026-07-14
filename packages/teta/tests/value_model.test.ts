import { describe, expect, test } from "bun:test";
import {
  eq,
  asc,
  isColumn,
  isExpr,
  isQuery,
  lit,
  param,
  upper,
  table,
  t,
  toIR,
  toSql,
  filter,
  sort,
  pipe,
} from "../mod.ts";
import { fn, windowFn } from "../advanced.ts";
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

  test("distinguishes portable built-ins from advanced custom functions", () => {
    expect(toExprNode(upper("Ada"))).toEqual({
      kind: "builtin",
      op: "UPPER",
      args: [{ kind: "literal", value: "Ada" }],
    });
    expect(toExprNode(fn("vendor_normalize", "Ada"))).toEqual({
      kind: "func",
      name: "vendor_normalize",
      args: [{ kind: "literal", value: "Ada" }],
    });
  });

  test("rejects invalid arity for portable built-ins", () => {
    expect(() => fn("UPPER")).toThrow("UPPER expects exactly 1 argument");
    expect(() => fn("DATE_ADD", "2025-01-01")).toThrow(
      "DATE_ADD expects exactly 3 arguments"
    );
  });

  test("creates immutable tagged column expressions", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    const id = users.columns.id;

    expect(id.kind).toBe("expr");
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
    expect(Object.isFrozen(users.columns)).toBe(true);
    expect("state" in users).toBe(false);
    expect("source" in users).toBe(false);
    expect("stages" in users).toBe(false);
    expect("columnNames" in users).toBe(false);
    expect(toIR(users).columnNames).toEqual(["id"]);

    const filtered = pipe(users, filter((user) => eq(user.id, lit(1))));
    const filteredIr = toIR(filtered);
    expect(filteredIr.stages).toHaveLength(1);
    expect(filteredIr.stages[0]?.kind).toBe("filter");
  });

  test("keeps schema helper values immutable", () => {
    const nullableString = t.nullable(t.string());

    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(nullableString)).toBe(true);
  });

  test("rejects malformed expression-like values", () => {
    expect(isExpr({ kind: "expr", node: { kind: "literal", value: 1 } })).toBe(false);
    expect(isExpr({ kind: "expr", node: null })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "bogus" } })).toBe(false);
    expect(isColumn({
      kind: "expr",
      node: { kind: "literal", value: 1 },
      table: null,
      name: "id",
    })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "param", name: null } })).toBe(false);
    expect(isExpr({ kind: "expr", node: { kind: "param", name: "" } })).toBe(false);
    expect(isExpr(param("id"))).toBe(true);
    expect(() => toExprNode({ kind: "expr", node: null } as any)).toThrow(
      "Unsupported literal value"
    );
    expect(() => toExprNode({ kind: "expr", node: { kind: "bogus" } } as any)).toThrow(
      "Unsupported literal value"
    );
    expect(() => lit({ kind: "bigint_literal", value: "not-a-bigint" } as never)).toThrow(
      "Unsupported literal value"
    );
    expect(() => toExprNode({ kind: "date_literal" } as never)).toThrow(
      "Unsupported literal value"
    );
    expect(() => lit(Number.NaN as never)).toThrow("Unsupported literal value");
  });

  test("rejects malformed query-like values", () => {
    const users = table("users", {
      id: t.int(),
    });
    const malformedStages = [{ kind: "filter" }];
    const forged = {
      ...users,
      state: {
        ...toIR(users),
        stages: malformedStages,
      },
      stages: malformedStages,
    };

    expect(isQuery(forged)).toBe(false);

    const malformedPredicateStages = [{
      kind: "filter",
      predicate: { kind: "literal" },
      projectAll: [{
        expr: users.columns.id.node,
        as: { name: "id", quoted: false },
      }],
    }];
    const forgedWithMalformedPredicate = {
      ...users,
      state: {
        ...toIR(users),
        stages: malformedPredicateStages,
      },
      stages: malformedPredicateStages,
    };

    expect(isQuery(forgedWithMalformedPredicate)).toBe(false);
  });

  test("rejects structurally forged query values without the internal brand", () => {
    const users = table("users", {
      id: t.int(),
    });
    const forged = {
      ...users,
      state: toIR(users),
    };

    expect(isQuery(forged)).toBe(false);
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

  test("order item callbacks validate branded expression nodes", () => {
    const users = table("users", {
      id: t.int(),
    });

    const query = pipe(users, sort((user) => asc(user.id)));

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id AS id FROM users AS users_0 ORDER BY users_0.id ASC"
    );
  });

  test("throws when untyped code uses an unknown callback column", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    expect(() => {
      pipe(
        users,
        filter((row) => eq((row as any).missing, 1))
      );
    }).toThrow("Unsupported literal value: undefined");
  });

  test("allows reflective names when they are callback columns", () => {
    const events = table("events", {
      then: t.string(),
      toJSON: t.string(),
      inspect: t.string(),
    });

    const query = pipe(
      events,
      filter((row) => eq(row.then, row.toJSON)),
      filter((row) => eq(row.inspect, "ok"))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      'SELECT events_0.then AS then, events_0."toJSON" AS "toJSON", events_0.inspect AS inspect FROM events AS events_0 WHERE events_0.then = events_0."toJSON" AND events_0.inspect = \'ok\''
    );
  });
});
