import { describe, expect, test } from "bun:test";
import { table, t, filter, eq, gt, map, take, toSql, innerJoin } from "../mod.ts";
describe("render strategy", () => {
    test("optimized strategy keeps simple pipelines fused", () => {
        const users = table("users", {
            id: t.int(),
            active: t.boolean(),
        });
        const sql = toSql(take(map(filter(users, (user) => eq(user.active, true)), (user) => ({ id: user.id })), 1), {
            dialect: "postgresql",
            format: "compact",
            renderStrategy: "optimized",
        });
        expect(sql).not.toContain("WITH ");
        expect(sql).toBe("SELECT users_0.id FROM users AS users_0 WHERE users_0.active = TRUE LIMIT 1");
    });
    test("readable strategy preserves stage boundaries with CTEs", () => {
        const users = table("users", {
            id: t.int(),
            active: t.boolean(),
        });
        const sql = toSql(take(map(filter(users, (user) => eq(user.active, true)), (user) => ({ id: user.id })), 1), {
            dialect: "postgresql",
            format: "compact",
            renderStrategy: "readable",
        });
        expect(sql).toContain("WITH cte_0(id, active) AS");
        expect(sql).toContain("cte_1(id) AS");
        expect(sql).toContain("LIMIT 1");
    });
    test("readable strategy still dedupes identical hoisted join subqueries", () => {
        const users = table("users", {
            id: t.int(),
            active: t.boolean(),
        });
        const orders = table("orders", {
            id: t.int(),
            user_id: t.int(),
            total: t.float(),
        });
        const positiveOrders = map(filter(orders, (order) => gt(order.total, 0)), (order) => ({
            user_id: order.user_id,
            total: order.total,
        }));
        const joinedOnce = innerJoin(users, positiveOrders, (user, order) => eq(user.id, order.user_id), (user, order) => ({
            id: user.id,
            first_total: order.total,
        }));
        const query = innerJoin(joinedOnce, positiveOrders, (row, order) => eq(row.id, order.user_id), (row, order) => ({
            id: row.id,
            first_total: row.first_total,
            second_total: order.total,
        }));
        const sql = toSql(query, {
            dialect: "postgresql",
            format: "compact",
            renderStrategy: "readable",
        });
        expect(sql).toContain("WITH join_0(user_id, total) AS (SELECT");
        expect(sql).not.toContain("join_1(");
        expect(sql.match(/JOIN join_0 AS /g)?.length).toBe(2);
    });
});
