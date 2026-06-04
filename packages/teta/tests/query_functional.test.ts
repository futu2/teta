import { describe, expect, test } from "bun:test";
import { between, filter, filterEq, identityStep, isDistinctFrom, isNotIn, take, takeWithin, sort, map, toSql, asc, desc, eq, gte, replace, and, coalesce, join, leftJoin, leftJoinMerge, onEq, prefixOverlapLeft, table, t, pipe, flow, unlessStep, unionAll, union, unnest, whenStep } from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT, USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createOrdersTable, createUsersPipelineTable, createUsersTable } from "./helpers/fixtures.ts";
describe("function-first query api", () => {
    test("composes a pipeline with Teta pipe", () => {
        const users = createUsersPipelineTable();
        const query = pipe(users, filter((user: typeof users.columns) => and(eq(user.active, true), gte(user.age, 18))), map((user) => ({
            id: user.id,
            name: coalesce(replace(user.name, " ", "_"), "unknown"),
            age: user.age,
        })), sort((row) => [asc(row.name), desc(row.id)]), take(20));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("composes reusable query steps with Teta flow", () => {
        const users = createUsersPipelineTable();
        const activeUserPipeline = flow(
            filter((user: typeof users.columns) => and(eq(user.active, true), gte(user.age, 18))),
            map((user) => ({
                id: user.id,
                name: coalesce(replace(user.name, " ", "_"), "unknown"),
                age: user.age,
            })),
            sort((row) => [asc(row.name), desc(row.id)]),
            take(20)
        );

        expect(toSql(activeUserPipeline(users), { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("composes ordinary functions with Teta flow", () => {
        const addOne = (value: number) => value + 1;
        const toLabel = (value: number) => `n=${value}`;

        expect(flow(addOne, toLabel)(41)).toBe("n=42");
    });
    test("uses simple boolean query-step combinators", () => {
        const users = createUsersPipelineTable();
        const query = pipe(
            users,
            identityStep(),
            whenStep(true, filterEq((user) => user.active, true)),
            whenStep(false, filterEq((user) => user.age, 99)),
            unlessStep(false, take(5))
        );

        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS id, users_0.name AS name, users_0.age AS age, users_0.active AS active FROM users AS users_0 WHERE users_0.active = TRUE LIMIT 5");
    });
    test("takes rows within a partition using row_number", () => {
        const employees = table("employees", {
            id: t.int(),
            name: t.string(),
            role: t.string(),
            join_date: t.date(),
        });
        const query = pipe(
            employees,
            takeWithin({
                partitionBy: (employee) => employee.role,
                orderBy: (employee) => asc(employee.join_date),
                count: 1,
            })
        );

        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT t_0.id, t_0.name, t_0.role, t_0.join_date FROM (SELECT employees_0.id, employees_0.name, employees_0.role, employees_0.join_date, row_number() OVER (PARTITION BY employees_0.role ORDER BY employees_0.join_date ASC) AS __teta_take_within_row_number FROM employees AS employees_0) AS t_0 WHERE t_0.__teta_take_within_row_number <= 1");
    });
    test("uses curried aliases for union and unnest helpers", () => {
        const users = table("users", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const archivedUsers = table("archived_users", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const unioned = pipe(users, union(archivedUsers), unionAll(archivedUsers));
        const exploded = pipe(users, unnest((user) => user.tags, { value: "tag" }));

        expect(toSql(unioned, { dialect: "postgresql", format: "compact" })).toBe("WITH cte_0(id, tags) AS (SELECT users_0.id, users_0.tags FROM users AS users_0 UNION SELECT archived_users_0.id, archived_users_0.tags FROM archived_users AS archived_users_0) SELECT cte_0_0.id, cte_0_0.tags FROM cte_0 AS cte_0_0 UNION ALL SELECT archived_users_0.id, archived_users_0.tags FROM archived_users AS archived_users_0");
        expect(toSql(exploded, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS id, users_0.tags AS tags, unnest_1.tag AS tag FROM users AS users_0 CROSS JOIN LATERAL UNNEST(users_0.tags) AS unnest_1(tag)");
    });
    test("renders additional predicate conveniences", () => {
        const users = createUsersPipelineTable();
        const query = pipe(
            users,
            filter((user) => and(
                between(user.age, 18, 64),
                isNotIn(user.name, ["bot", "test"]),
                isDistinctFrom(user.name, "anonymous")
            )),
            map((user) => ({ id: user.id }))
        );

        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id FROM users AS users_0 WHERE users_0.age BETWEEN 18 AND 64 AND users_0.name NOT IN ('bot', 'test') AND users_0.name IS DISTINCT FROM 'anonymous'");
    });
    test("supports curried join with a built query", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = pipe(
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
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
    });
    test("supports join primitive with explicit type and select", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = pipe(
            users,
            join(orders, {
                type: "left",
                on: (user, order) => eq(user.id, order.user_id),
                select: (user, order) => ({
                    user_id: user.id,
                    total: order.total,
                }),
            })
        );

        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS user_id, orders_1.total AS total FROM users AS users_0 LEFT JOIN orders AS orders_1 ON users_0.id = orders_1.user_id");
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
        const query = pipe(
            users,
            leftJoinMerge(
                profiles,
                onEq({ id: "user_id" }),
                prefixOverlapLeft("left_")
            ),
            map((row) => ({
                left_id: row.left_id,
                bio: row.bio,
            }))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS left_id, profiles_1.bio AS bio FROM users AS users_0 LEFT JOIN profiles AS profiles_1 ON users_0.id = profiles_1.user_id");
    });
    test("supports curried 3-arg join when predicate uses default parameter", () => {
        const users = table("users", {
            id: t.int(),
        });
        const profiles = table("profiles", {
            id: t.int(),
            user_id: t.int(),
            bio: t.string(),
        });
        const query = leftJoinMerge(
            profiles,
            (u: typeof users.columns, p: typeof profiles.columns = profiles.columns) => eq(u.id, p.user_id),
            prefixOverlapLeft("left_")
        )(users);
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS left_id, profiles_1.id AS id, profiles_1.user_id AS user_id, profiles_1.bio AS bio FROM users AS users_0 LEFT JOIN profiles AS profiles_1 ON users_0.id = profiles_1.user_id");
    });
});
