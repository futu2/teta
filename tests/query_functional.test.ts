import { describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { filter, take, sort, map, toSql, asc, desc, eq, gte, replace, and, coalesce, join } from "../mod.ts";
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
        const query = pipe(users, join(orders, (user, order) => eq(user.id, order.user_id), { type: "left" }), map((row) => ({
            user_id: row.id,
            total: row.total,
        })));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
    });
});
