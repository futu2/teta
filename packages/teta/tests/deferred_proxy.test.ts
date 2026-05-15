import { describe, expect, test } from "bun:test";
import {
  TetaUserError,
  add,
  alias,
  and,
  asc,
  caseWhen,
  coalesce,
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

describe("callback column api", () => {
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
      filter((user) => and(eq(user.active, true), gte(user.age, 18))),
      map((user) => ({
        id: user.id,
        name: coalesce(replace(user.name, " ", "_"), "unknown"),
        age: user.age,
      })),
      sort((row) => [asc(row.name), desc(row.id)]),
      take(20)
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

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

  test("treats bare strings in filterEq as SQL literals", () => {
    const users = table("users", {
      status: t.string(),
    });
    const expected = pipe(users, filter(() => eq("status", "status")));
    const actual = pipe(users, filterEq("status", "status"));

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

  test("matches callback SQL for typed filter, map, sort, and take", () => {
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
      filter((user) => and(eq(user.active, true), gte(user.age, 18))),
      map((user) => ({
        id: user.id,
        name: coalesce(replace(user.name, " ", "_"), "unknown"),
        age: user.age,
      })),
      sort((row) => [asc(row.name), desc(row.id)]),
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

  test("supports select with callback column lists after map", () => {
    const users = createUsersPipelineTable();
    const mapped = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
    })));
    const expected = pipe(mapped, map((user) => ({
      id: user.id,
      name: user.name,
    })));
    const actual = pipe(mapped, select((user) => [user.id, user.name]));

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
      () => pipe(users, select((user: typeof users.columns) => [user.id, pipe(user.name, alias("id"))]) as never),
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

  test("supports extend with callback selection", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      age: user.age,
      active: user.active,
      active_label: caseWhen([when(user.active, "active")], "inactive"),
    })));
    const actual = pipe(users, extend((user) => ({
      active_label: caseWhen([when(user.active, "active")], "inactive"),
    })));

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
    const actual = pipe(orders, fold((order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed fold aggregations", () => {
    const orders = createOrdersTable();
    const expected = pipe(orders, fold((order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    })));
    const actual = pipe(orders, fold((order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for unnest", () => {
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const expected = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
    const actual = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed unnest", () => {
    const sessions = table("sessions", {
      id: t.int(),
      tags: t.array(t.string()),
    });
    const expected = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
    const actual = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));

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
        (user, order) => eq(user.id, order.user_id)
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

  test("supports callback join merge shapes", () => {
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
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          user_id: user.id,
          order_total: order.total,
        })
      )
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for typed join merge callbacks", () => {
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
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          user_id: user.id,
          order_total: order.total,
        })
      )
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports option-named callback join merge output keys", () => {
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
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({
          type: user.type,
          lateral: order.total,
        })
      )
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
          undefined as never
        )
      ),
      "DEFERRED_INPUT_INVALID"
    );
  });

});
