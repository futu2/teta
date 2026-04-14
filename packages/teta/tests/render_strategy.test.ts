import { describe, expect, test } from "bun:test";
import { table, t, filter, eq, map, take, toSql } from "../mod.ts";
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
});
