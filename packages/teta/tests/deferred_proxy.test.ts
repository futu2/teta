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
});
