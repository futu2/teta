import { describe, expect, test } from "bun:test";
import {
  fold,
  groupShape,
  lt,
  map,
  pipe,
  sum,
  table,
  t,
  toSql,
  when,
} from "../mod.ts";

describe("functional expression builders", () => {
  test("renders when from alternating condition/value pairs", () => {
    const users = table("users", {
      id: t.int(),
      age: t.int(),
    });

    const query = pipe(users, map((user) => ({
      age_group: when(
        lt(user.age, 18), "minor",
        lt(user.age, 65), "adult",
        true, "senior"
      ),
    })));

    const sql = toSql(query, { dialect: "postgresql", format: "compact" });

    expect(sql).toContain("CASE WHEN users_0.age < 18 THEN 'minor' WHEN users_0.age < 65 THEN 'adult' WHEN TRUE THEN 'senior' END AS age_group");
  });

  test("renders groupShape without shape methods", () => {
    const orders = table("orders", {
      id: t.int(),
      user_id: t.int(),
      total: t.float(),
    });

    const query = pipe(orders, fold((order) => ({
      ...groupShape({ user_id: order.user_id }),
      total_spend: sum(order.total),
    })));

    const sql = toSql(query, { dialect: "postgresql", format: "compact" });

    expect(sql).toContain("GROUP BY orders_0.user_id");
    expect(sql).toContain("SUM(orders_0.total) AS total_spend");
  });

  test("rejects reserved projection keys", () => {
    const users = table("users", {
      id: t.int(),
    });

    expect(() => pipe(users, map((user) => ({
      __teta_internal: user.id,
    })))).toThrow("Projection key is reserved for Teta internals");
  });
});
