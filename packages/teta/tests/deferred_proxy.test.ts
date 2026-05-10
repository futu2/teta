import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import {
  $,
  $left,
  $right,
  ExprRef,
  and,
  asc,
  coalesce,
  count,
  desc,
  eq,
  filter,
  fold,
  group,
  gte,
  leftJoin,
  join,
  map,
  pickCols,
  replace,
  sort,
  sum,
  t,
  table,
  take,
  toSql,
  unnest,
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

describe("deferred row proxy api", () => {
  test("exports deferred row proxies that compose through expression helpers", () => {
    expect(eq($.id, 1)).toBeInstanceOf(ExprRef);
    expect(eq($left.id, $right.user_id)).toBeInstanceOf(ExprRef);
  });

  test("exports pickCols as a selector helper", () => {
    expect(typeof pickCols("id")).toBe("function");
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

  test("supports pickCols for same-name projection", () => {
    const users = createUsersTable();
    const expected = map(users, (user) => ({ id: user.id, name: user.name }));
    const actual = map(users, pickCols("id", "name"));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("matches callback SQL for fold aggregations", () => {
    const orders = createOrdersTable();
    const expected = fold(orders, (order) => ({
      user_id: group(order.user_id),
      order_count: count(order.order_id),
      total_spend: sum(order.total),
    }));
    const actual = fold(orders, {
      user_id: group($.user_id),
      order_count: count($.order_id),
      total_spend: sum($.total),
    });

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

  test("matches callback SQL for join predicates", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const expected = pipe(
      users,
      leftJoin(orders, (user, order) => eq(user.id, order.user_id)),
      map((row) => ({
        user_id: row.id,
        total: row.total,
      }))
    );
    const actual = pipe(
      users,
      leftJoin(orders, eq($left.id, $right.user_id)),
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
    const expected = leftJoin(
      users,
      orders,
      (user, order) => eq(user.id, order.user_id),
      (user, order) => ({
        user_id: user.id,
        order_total: order.total,
      })
    );
    const actual = leftJoin(
      users,
      orders,
      eq($left.id, $right.user_id),
      {
        user_id: $left.id,
        order_total: $right.total,
      }
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
    const expected = join(
      users,
      orders,
      (user, order) => eq(user.id, order.user_id),
      (user, order) => ({
        type: user.type,
        lateral: order.total,
      })
    );
    const actual = join(
      users,
      orders,
      eq($left.id, $right.user_id),
      {
        type: $left.type,
        lateral: $right.total,
      }
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("reports missing current-row deferred columns", () => {
    const users = createUsersTable();
    expect(() => map(users, { missing: $.missing })).toThrow(
      DEFERRED_CURRENT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports missing deferred join-left columns", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    expect(() => leftJoin(users, orders, eq($left.missing, $right.user_id))).toThrow(
      DEFERRED_LEFT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports missing deferred join-right columns", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    expect(() => leftJoin(users, orders, eq($left.id, $right.missing))).toThrow(
      DEFERRED_RIGHT_COLUMN_UNKNOWN_ERROR
    );
  });

  test("reports join-side deferred refs outside join helpers", () => {
    const users = createUsersTable();
    expect(() => filter(users, eq($left.id, 1))).toThrow(DEFERRED_LEFT_SCOPE_ERROR);
  });
});
