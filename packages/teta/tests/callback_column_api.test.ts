import { describe, expect, test } from "bun:test";
import {
  TetaUserError,
  add,
  and,
  eq,
  filter,
  filterEq,
  filterGt,
  filterGte,
  filterLt,
  filterLte,
  filterNe,
  fold,
  inner,
  join,
  param,
  gt,
  gte,
  isNotNull,
  left,
  lt,
  lte,
  map,
  mul,
  ne,
  onEq,
  or,
  pipe,
  sort,
  t,
  table,
  toSql,
  unnest,
} from "../mod.ts";
import type { TetaErrorCode } from "../mod.ts";
import {
  createOrdersTable,
  createUsersPipelineTable,
  createUsersTable,
} from "./helpers/fixtures.ts";

function expectTetaUserError(fn: () => unknown, code: TetaErrorCode): void {
  try {
    fn();
    throw new Error("Expected TetaUserError");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).kind).toBe("user");
    expect((error as TetaUserError).code).toBe(code);
  }
}

describe("callback column api", () => {
  test("supports variadic and for callback filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter((user) => and(and(eq(user.active, true), gte(user.age, 18)), isNotNull(user.name)))
    );
    const actual = pipe(
      users,
      filter((user) => and(eq(user.active, true), gte(user.age, 18), isNotNull(user.name)))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports variadic or for callback filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter((user) => or(or(eq(user.name, "Ada"), eq(user.name, "Grace")), eq(user.name, "Linus")))
    );
    const actual = pipe(
      users,
      filter((user) => or(eq(user.name, "Ada"), eq(user.name, "Grace"), eq(user.name, "Linus")))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterEq with callback expression operands", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter((user) => eq(user.active, true)));
    const actual = pipe(users, filterEq((user) => user.active, true));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterGte with computed callback operands", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter((user) => gte(add(mul(user.age, 2), 1), 37)));
    const actual = pipe(users, filterGte((user) => add(mul(user.age, 2), 1), 37));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterEq with callbacks on both operands", () => {
    const users = table("users", {
      age: t.int(),
      expected_age: t.int(),
    });
    const expected = pipe(users, filter((user) => eq(user.age, user.expected_age)));
    const actual = pipe(users, filterEq((user) => user.age, (user) => user.expected_age));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("rejects comparison filters without a row callback", () => {
    expectTetaUserError(
      () => (filterEq as any)("status", "status"),
      "QUERY_HELPER_INVALID_ARGUMENTS"
    );
  });

  test("supports filterGt with callback on the right operand", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter((user) => gt(18, user.age)));
    const actual = pipe(users, filterGt(18, (user) => user.age));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports comparison filter helpers for remaining operators", () => {
    const users = createUsersPipelineTable();
    const cases = [
      [pipe(users, filter((user) => ne(user.name, "deleted"))), pipe(users, filterNe((user) => user.name, "deleted"))],
      [pipe(users, filter((user) => gt(user.age, 18))), pipe(users, filterGt((user) => user.age, 18))],
      [pipe(users, filter((user) => lt(user.age, 65))), pipe(users, filterLt((user) => user.age, 65))],
      [pipe(users, filter((user) => lte(user.age, 65))), pipe(users, filterLte((user) => user.age, 65))],
    ] as const;

    for (const [expected, actual] of cases) {
      expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
        toSql(expected, { dialect: "postgresql", format: "compact" })
      );
    }
  });

  test("matches callback SQL for onEq join predicates", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      join(
        orders,
        left((user, order) => eq(user.id, order.user_id))
      ),
      map((row) => ({
        user_id: row.id,
        total: row.total,
      }))
    );
    const actual = pipe(
      users,
      join(
        orders,
        left(onEq({ id: "user_id" }))
      ),
      map((row) => ({
        user_id: row.id,
        total: row.total,
      }))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("reports undefined callback helper inputs as user errors", () => {
    const users = createUsersTable();
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const orders = createOrdersTable();

    expectTetaUserError(() => pipe(users, filter(undefined as never)), "DEFERRED_INPUT_INVALID");
    expectTetaUserError(() => pipe(users, sort(undefined as never)), "DEFERRED_INPUT_INVALID");
    expectTetaUserError(
      () => pipe(sessions, unnest(undefined as never, { value: "tag" })),
      "DEFERRED_INPUT_INVALID"
    );
    expectTetaUserError(
      () => pipe(
        users,
        join(
          orders,
          inner(undefined as never)
        )
      ),
      "DEFERRED_INPUT_INVALID"
    );
  });

  test("rejects malformed expression operands in comparison helpers at runtime", () => {
    const users = createUsersTable();
    const cases = [
      { kind: "expr", node: { kind: "bogus", value: undefined } },
      { kind: "expr", node: { kind: "bogus", value: null } },
      { kind: "expr", node: { kind: "bogus", value: "bad" } },
      { kind: "expr", node: { kind: "bogus" } },
      { kind: "expr", node: { kind: "column" } },
      {
        kind: "expr",
        node: {
          kind: "binary",
          op: "=",
          left: null,
          right: { kind: "literal", value: "Ada" },
        },
      },
      {
        kind: "expr",
        node: {
          kind: "binary",
          op: "=",
          left: { kind: "bogus" },
          right: { kind: "literal", value: "Ada" },
        },
      },
      {
        kind: "expr",
        node: {
          kind: "binary",
          op: "=",
          left: { kind: "column" },
          right: { kind: "literal", value: "Ada" },
        },
      },
      { kind: "expr", node: { kind: "func", name: "BAD", args: null } },
      { kind: "expr", node: { kind: "case", whens: null, elseExpr: null } },
      { kind: "expr", node: { kind: "case", whens: [], elseExpr: 0 } },
      {
        kind: "expr",
        node: {
          kind: "window",
          name: "BAD",
          args: [],
          partitionBy: null,
          orderBy: [null],
        },
      },
      {
        kind: "expr",
        node: {
          kind: "window",
          name: "BAD",
          args: [],
          partitionBy: null,
          orderBy: [{ direction: "SIDEWAYS", expr: { kind: "literal", value: "Ada" } }],
        },
      },
    ];

    for (const malformed of cases) {
      expectTetaUserError(
        () => pipe(users, filterEq(() => malformed as any, "Ada")),
        "QUERY_FILTER_INVALID_OPERAND"
      );
    }

    const valid = pipe(users, filterEq(() => param("name", t.string()), "Ada"));
    expect(toSql(valid, {
      dialect: "postgresql",
      format: "compact",
      params: { name: "Ada" },
    })).toContain(":name = 'Ada'");
  });

});
