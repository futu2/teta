import { describe, expect, test } from "bun:test";
import {
  $,
  $left,
  $right,
  ExprRef,
  TetaInternalError,
  TetaUserError,
  add,
  alias,
  and,
  asc,
  caseWhen,
  coalesce,
  col,
  count,
  desc,
  eq,
  extend,
  filter,
  filterEq,
  filterGt,
  filterGte,
  filterLt,
  filterLte,
  filterNe,
  fold,
  gt,
  group,
  gte,
  isNotNull,
  leftJoin,
  leftCol,
  join,
  lt,
  lte,
  map,
  mul,
  ne,
  or,
  drop,
  pick,
  pipe,
  rename,
  replace,
  rightCol,
  select,
  sort,
  sum,
  t,
  table,
  take,
  toSql,
  unnest,
  when,
} from "../mod.ts";
import {
  createOrdersTable,
  createUsersPipelineTable,
  createUsersTable,
} from "./helpers/fixtures.ts";
import {
  DEFERRED_CURRENT_COLUMN_UNKNOWN_ERROR,
  DEFERRED_LEFT_COLUMN_UNKNOWN_ERROR,
  DEFERRED_LEFT_SCOPE_ERROR,
  DEFERRED_RIGHT_COLUMN_UNKNOWN_ERROR,
} from "./helpers/expected-errors.ts";

function expectTetaUserError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("Expected TetaUserError");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).kind).toBe("user");
    expect((error as TetaUserError).code).toBe(code);
  }
}

describe("deferred row proxy api", () => {
  test("exports deferred row proxies that compose through expression helpers", () => {
    expect(eq($.id, 1)).toBeInstanceOf(ExprRef);
    expect(eq($left.id, $right.user_id)).toBeInstanceOf(ExprRef);
  });

  test("exports projection helpers as query steps", () => {
    expect(typeof pick("id")).toBe("function");
    expect(typeof drop("id")).toBe("function");
    expect(typeof rename((key) => key)).toBe("function");
  });

  test("matches callback SQL for filter, map, sort, and take", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter((user) => and(eq(user.active, true), gte(user.age, 18))),
      map((user) => ({
        id: user.id,
        name: coalesce(replace(user.name, " ", "_"), "unknown"),
        age: user.age,
      })),
      sort((row) => [asc(row.name), desc(row.id)]),
      take(20)
    );
    const actual = pipe(
      users,
      filter(and(eq($.active, true), gte($.age, 18))),
      map({
        id: $.id,
        name: coalesce(replace($.name, " ", "_"), "unknown"),
        age: $.age,
      }),
      sort([asc($.name), desc($.id)]),
      take(20)
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports variadic and for deferred filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter(and(and(eq($.active, true), gte($.age, 18)), isNotNull($.name)))
    );
    const actual = pipe(
      users,
      filter(and(eq($.active, true), gte($.age, 18), isNotNull($.name)))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports variadic or for deferred filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter(or(or(eq($.name, "Ada"), eq($.name, "Grace")), eq($.name, "Linus")))
    );
    const actual = pipe(
      users,
      filter(or(eq($.name, "Ada"), eq($.name, "Grace"), eq($.name, "Linus")))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterEq with deferred expression operands", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter(eq(col("active"), true)));
    const actual = pipe(users, filterEq(col("active"), true));

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

  test("treats bare strings in filterEq as SQL literals", () => {
    const users = table("users", {
      status: t.string(),
    });
    const expected = pipe(users, filter(eq("status", col("status"))));
    const actual = pipe(users, filterEq("status", col("status")));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
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
      [pipe(users, filter(ne(col("name"), "deleted"))), pipe(users, filterNe(col("name"), "deleted"))],
      [pipe(users, filter(gt(col("age"), 18))), pipe(users, filterGt(col("age"), 18))],
      [pipe(users, filter(lt(col("age"), 65))), pipe(users, filterLt(col("age"), 65))],
      [pipe(users, filter(lte(col("age"), 65))), pipe(users, filterLte(col("age"), 65))],
    ] as const;

    for (const [expected, actual] of cases) {
      expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
        toSql(expected, { dialect: "postgresql", format: "compact" })
      );
    }
  });

  test("matches callback SQL for typed col filter, map, sort, and take", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter((user) => and(eq(user.active, true), gte(user.age, 18))),
      map((user) => ({
        id: user.id,
        name: coalesce(replace(user.name, " ", "_"), "unknown"),
        age: user.age,
      })),
      sort((row) => [asc(row.name), desc(row.id)]),
      take(20)
    );
    const actual = pipe(
      users,
      filter(and(eq(col("active"), true), gte(col("age"), 18))),
      map({
        id: col("id"),
        name: coalesce(replace(col("name"), " ", "_"), "unknown"),
        age: col("age"),
      }),
      sort([asc(col("name")), desc(col("id"))]),
      take(20)
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports select with callback column lists", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
    })));
    const actual = pipe(users, select((user) => [user.id, user.name]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports select with deferred column lists", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map({
      id: $.id,
      name: $.name,
    }));
    const actual = pipe(users, select([$.id, $.name]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports select aliases and generated names", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      old_id: user.id,
      col_1: add(user.age, 1),
      name: user.name,
      col_2: add(user.age, 2),
    })));
    const actual = pipe(users, select((user) => [
      pipe(user.id, alias("old_id")),
      add(user.age, 1),
      user.name,
      add(user.age, 2),
    ]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("rejects duplicate select output names", () => {
    const users = createUsersPipelineTable();

    expectTetaUserError(
      () => pipe(users, select((user) => [user.id, pipe(user.name, alias("id"))])),
      "SELECT_DUPLICATE_COLUMN"
    );
  });

  test("supports drop as a direct query step", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      active: user.active,
    })));
    const actual = pipe(users, drop("age"));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports extend as a direct query step", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      age: user.age,
      active: user.active,
      normalized_name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));
    const actual = pipe(users, extend((user) => ({
      normalized_name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports extend with deferred selection", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      age: user.age,
      active: user.active,
      active_label: caseWhen([when(user.active, "active")], "inactive"),
    })));
    const actual = pipe(users, extend({
      active_label: caseWhen([when($.active, "active")], "inactive"),
    }));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports extend replacing an existing column", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: coalesce(replace(user.name, " ", "_"), "unknown"),
      age: user.age,
      active: user.active,
    })));
    const actual = pipe(users, extend((user) => ({
      name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("reports missing picked columns", () => {
    const users = createUsersTable();

    expectTetaUserError(
      // @ts-expect-error exercising runtime validation for an unknown dynamic column
      () => pipe(users, pick("missing")),
      "DEFERRED_COLUMN_UNKNOWN"
    );
  });

  test("reports missing dropped columns", () => {
    const users = createUsersTable();

    expectTetaUserError(
      // @ts-expect-error exercising runtime validation for an unknown dynamic column
      () => pipe(users, drop("missing")),
      "DEFERRED_COLUMN_UNKNOWN"
    );
  });

  test("supports pick as a direct query step", () => {
    const users = createUsersTable();
    const expected = pipe(users, map((user) => ({ id: user.id, name: user.name })));
    const actual = pipe(users, pick("id", "name"));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports rename as a direct query step", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      user_id: user.id,
      user_name: user.name,
      user_age: user.age,
      user_active: user.active,
    })));
    const actual = pipe(users, rename((key) => `user_${key}`));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for fold aggregations", () => {
    const orders = createOrdersTable();
    const expected = pipe(orders, fold((order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    })));
    const actual = pipe(orders, fold({
      user_id: group($.user_id),
      order_count: count($.order_id),
      total_spend: sum($.total),
    }));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed col fold aggregations", () => {
    const orders = createOrdersTable();
    const expected = pipe(orders, fold((order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    })));
    const actual = pipe(orders, fold({
      user_id: group(col("user_id")),
      order_count: count(col("order_id")),
      total_spend: sum(col("total")),
    }));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for unnest", () => {
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const expected = unnest(sessions, (session) => session.tags, { value: "tag" });
    const actual = unnest(sessions, $.tags, { value: "tag" });

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed col unnest", () => {
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const expected = unnest(sessions, (session) => session.tags, { value: "tag" });
    const actual = unnest(sessions, col("tags"), { value: "tag" });

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for join predicates", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      leftJoin(
        orders,
        (user, order) => eq(user.id, order.user_id)
      ),
      map((row) => ({
        user_id: row.id,
        total: row.total,
      }))
    );
    const actual = pipe(
      users,
      leftJoin(
        orders,
        eq($left.id, $right.user_id)
      ),
      map({
        user_id: $.id,
        total: $.total,
      })
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports deferred join merge shapes", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      leftJoin(
        orders,
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          user_id: user.id,
          order_total: order.total,
        })
      )
    );
    const actual = pipe(
      users,
      leftJoin(
        orders,
        eq($left.id, $right.user_id),
        {
          user_id: $left.id,
          order_total: $right.total,
        }
      )
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed join column refs", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      leftJoin(
        orders,
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          user_id: user.id,
          order_total: order.total,
        })
      )
    );
    const actual = pipe(
      users,
      leftJoin(
        orders,
        eq(leftCol("id"), rightCol("user_id")),
        {
          user_id: leftCol("id"),
          order_total: rightCol("total"),
        }
      )
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports option-named deferred join merge output keys", () => {
    const users = table("users", {
      id: t.int(),
      type: t.string(),
    });
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      join(
        orders,
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          type: user.type,
          lateral: order.total,
        })
      )
    );
    const actual = pipe(
      users,
      join(
        orders,
        eq($left.id, $right.user_id),
        {
          type: $left.type,
          lateral: $right.total,
        }
      )
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("reports missing current-row deferred columns", () => {
    const users = createUsersTable();
    expect(() => pipe(users, map({ missing: $.missing }))).toThrow(
      DEFERRED_CURRENT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports missing deferred join-left columns", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    expect(() => pipe(
      users,
      leftJoin(
        orders,
        eq($left.missing, $right.user_id)
      )
    )).toThrow(
      DEFERRED_LEFT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports missing deferred join-right columns", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    expect(() => pipe(
      users,
      leftJoin(
        orders,
        eq($left.id, $right.missing)
      )
    )).toThrow(
      DEFERRED_RIGHT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports join-side deferred refs outside join helpers", () => {
    const users = createUsersTable();
    expect(() => pipe(users, filter(eq($left.id, 1)))).toThrow(DEFERRED_LEFT_SCOPE_ERROR);
  });

  test("reports undefined deferred helper inputs as user errors", () => {
    const users = createUsersTable();
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const orders = createOrdersTable();

    expectTetaUserError(() => pipe(users, filter(undefined as never)), "DEFERRED_INPUT_INVALID");
    expectTetaUserError(() => pipe(users, sort(undefined as never)), "DEFERRED_INPUT_INVALID");
    expectTetaUserError(
      () => unnest(sessions, undefined as never, { value: "tag" }),
      "DEFERRED_INPUT_INVALID"
    );
    expectTetaUserError(
      () => pipe(
        users,
        join(
          orders,
          undefined as never
        )
      ),
      "DEFERRED_INPUT_INVALID"
    );
  });

  test("reports invalid deferred join merge values as user errors", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();

    expectTetaUserError(
      () => pipe(
        users,
        join(
          orders,
          eq($left.id, $right.user_id),
          { bad: 1 } as never
        )
      ),
      "DEFERRED_PROJECTION_INVALID"
    );
  });

  test("guards direct rendering of unresolved deferred refs", () => {
    expect(() => toSql($.id as ExprRef<unknown>)).toThrow(TetaInternalError);
  });
});
