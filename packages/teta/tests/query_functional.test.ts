import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { filter, take, sort, map, toSql, asc, desc, eq, gte, replace, and, coalesce, leftJoin, onEq, prefixOverlapLeft, table, t } from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT, USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createOrdersTable, createUsersPipelineTable, createUsersTable } from "./helpers/fixtures.ts";
describe("function-first query api", () => {
    test("composes a pipeline with remeda pipe", () => {
        const users = createUsersPipelineTable();
        const query = pipe(users, filter((user: typeof users.columns) => and(eq(user.active, true), gte(user.age, 18))), map((user) => ({
            id: user.id,
            name: coalesce(replace(user.name, " ", "_"), "unknown"),
            age: user.age,
        })), sort((row) => [asc(row.name), desc(row.id)]), take(20));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("supports curried join with a built query", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = pipe(users, leftJoin(orders, (user, order) => eq(user.id, order.user_id)), map((row) => ({
            user_id: row.id,
            total: row.total,
        })));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
    });
    test("supports leftJoin with onEq mapping in function-first pipeline", () => {
        const users = table("users", {
            id: t.int(),
        });
        const profiles = table("profiles", {
            id: t.int(),
            user_id: t.int(),
            bio: t.string(),
        });
        const query = pipe(users, leftJoin(profiles, onEq({ id: "user_id" }), prefixOverlapLeft("left_")), map((row) => ({
            left_id: row.left_id,
            bio: row.bio,
        })));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS left_id, profiles_1.bio AS bio FROM users AS users_0 LEFT JOIN profiles AS profiles_1 ON users_0.id = profiles_1.user_id");
    });
});
