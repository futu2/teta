import { describe, expect, test } from "bun:test";
import { TetaUserError, alias, count, eq, extend, filter, fold, fullJoin, group, innerJoin, join, leftCol, leftJoin, loop, map, prefixOverlapLeft, rightCol, rightJoin, select, sort, take, toSql, values, pipe } from "../mod.ts";
import { EXTEND_CURRIED_ONLY_ERROR, FILTER_CURRIED_ONLY_ERROR, FOLD_CURRIED_ONLY_ERROR, FULL_JOIN_CURRIED_ONLY_ERROR, GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR, GROUP_OUTSIDE_AGGREGATE_ERROR, INNER_JOIN_CURRIED_ONLY_ERROR, JOIN_CURRIED_ONLY_ERROR, JOIN_MERGE_CONFLICT_ERROR, JOIN_OVERLAPPING_COLUMNS_ERROR, LEFT_JOIN_CURRIED_ONLY_ERROR, LEGACY_JOIN_MERGE_OPTION_ERROR, LEGACY_SELECTION_ARRAY_ERROR, LOOP_COLUMN_MISMATCH_ERROR, MAP_CURRIED_ONLY_ERROR, NON_CANONICAL_POSTGRES_DIALECT_ERROR, RIGHT_JOIN_CURRIED_ONLY_ERROR, SELECT_ALIAS_EMPTY_ERROR, SELECT_DUPLICATE_COLUMN_ERROR, SELECT_INVALID_SELECTION_ERROR, SORT_CURRIED_ONLY_ERROR, TAKE_CURRIED_ONLY_ERROR, UNSUPPORTED_CROSS_JOIN_ERROR, VALUES_COLUMN_MISMATCH_ERROR, VALUES_EMPTY_ERROR } from "./helpers/expected-errors.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("error paths", () => {
    function expectUserError(fn: () => unknown, code: string, message: string): void {
        try {
            fn();
            throw new Error("Expected TetaUserError");
        }
        catch (error) {
            expect(error).toBeInstanceOf(TetaUserError);
            expect((error as TetaUserError).kind).toBe("user");
            expect((error as TetaUserError).code).toBe(code);
            expect((error as TetaUserError).message).toBe(message);
        }
    }
    test("rejects group() outside fold", () => {
        const users = createUsersTable();
        expect(() => pipe(users, map((user) => ({
            bad: group(user.id),
        })))).toThrow(GROUP_OUTSIDE_AGGREGATE_ERROR);
    });
    test("rejects group() inside fold functions", () => {
        const users = createUsersTable();
        expect(() => pipe(users, fold((user) => ({
            bad: count(group(user.id)),
        })))).toThrow(GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR);
    });
    test("rejects unsupported join types through the query API", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expect(() => pipe(
            users,
            join(
                orders,
                (user, order) => eq(user.id, order.user_id),
                { type: "cross" as never }
            )
        )).toThrow(UNSUPPORTED_CROSS_JOIN_ERROR);
    });
    test("rejects legacy join merge options at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expect(() => pipe(
            users,
            join(
                orders,
                (user, order) => eq(user.id, order.user_id),
                {
                    merge: (user: typeof users.columns, order: typeof orders.columns) => ({
                        id: user.id,
                        total: order.total,
                    }),
                } as never
            )
        )).toThrow(LEGACY_JOIN_MERGE_OPTION_ERROR);
    });
    test("rejects default joins with overlapping output columns", () => {
        const users = createUsersTable();
        const profiles = values([
            { id: 1, bio: "A" },
            { id: 2, bio: "B" },
        ]);
        expect(() => pipe(
            users,
            (join as any)(
            profiles,
            (user: typeof users.columns, profile: typeof profiles.columns) => eq(user.id, profile.id)
            )
        )).toThrow(JOIN_OVERLAPPING_COLUMNS_ERROR);
    });
    test("rejects merge helpers that produce duplicate output columns", () => {
        const users = createUsersTable();
        const profiles = values([
            { id: 1, user_id: 1, bio: "A" },
            { id: 2, user_id: 2, bio: "B" },
        ]);
        expect(() => pipe(
            users,
            (join as any)(
            profiles,
            (user: typeof users.columns, profile: typeof profiles.columns) => eq(user.id, profile.user_id),
            prefixOverlapLeft("user_")
            )
        )).toThrow(JOIN_MERGE_CONFLICT_ERROR);
    });
    test("rejects removed data-first query helper calls at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => (map as any)(users, (user: typeof users.columns) => ({ id: user.id })),
            "QUERY_HELPER_CURRIED_ONLY",
            MAP_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (extend as any)(users, (user: typeof users.columns) => ({ name: user.name })),
            "QUERY_HELPER_CURRIED_ONLY",
            EXTEND_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (filter as any)(users, (user: typeof users.columns) => eq(user.id, 1)),
            "QUERY_HELPER_CURRIED_ONLY",
            FILTER_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (fold as any)(orders, (order: typeof orders.columns) => ({
                user_id: group(order.user_id),
                total: count(order.order_id),
            })),
            "QUERY_HELPER_CURRIED_ONLY",
            FOLD_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (sort as any)(users, (user: typeof users.columns) => user.id),
            "QUERY_HELPER_CURRIED_ONLY",
            SORT_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (take as any)(users, 10),
            "QUERY_HELPER_CURRIED_ONLY",
            TAKE_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (join as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
            "QUERY_HELPER_CURRIED_ONLY",
            JOIN_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (innerJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
            "QUERY_HELPER_CURRIED_ONLY",
            INNER_JOIN_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (leftJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
            "QUERY_HELPER_CURRIED_ONLY",
            LEFT_JOIN_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (rightJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
            "QUERY_HELPER_CURRIED_ONLY",
            RIGHT_JOIN_CURRIED_ONLY_ERROR
        );
        expectUserError(
            () => (fullJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
            "QUERY_HELPER_CURRIED_ONLY",
            FULL_JOIN_CURRIED_ONLY_ERROR
        );
    });
    test("rejects removed data-first lateral join callbacks at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => (join as any)(
                users,
                (user: typeof users.columns) =>
                    pipe(
                        orders,
                        filter((order: typeof orders.columns) => eq(order.user_id, user.id))
                    ),
                (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)
            ),
            "QUERY_HELPER_CURRIED_ONLY",
            JOIN_CURRIED_ONLY_ERROR
        );
    });
    test("rejects removed data-first lateral join with deferred on expression at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => (join as any)(
                users,
                (user: typeof users.columns) =>
                    pipe(
                        orders,
                        filter((order: typeof orders.columns) => eq(order.user_id, user.id))
                    ),
                eq(leftCol("id"), rightCol("user_id"))
            ),
            "QUERY_HELPER_CURRIED_ONLY",
            JOIN_CURRIED_ONLY_ERROR
        );
    });
    test("rejects removed fixed data-first lateral join with deferred on expression at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => (leftJoin as any)(
                users,
                (user: typeof users.columns) =>
                    pipe(
                        orders,
                        filter((order: typeof orders.columns) => eq(order.user_id, user.id))
                    ),
                eq(leftCol("id"), rightCol("user_id"))
            ),
            "QUERY_HELPER_CURRIED_ONLY",
            LEFT_JOIN_CURRIED_ONLY_ERROR
        );
    });
    test("rejects loop steps with mismatched column names", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const base = pipe(users, map((user) => ({ id: user.id })));
        const invalidStep = () => pipe(orders, map((order) => ({
            user_id: order.user_id,
        }))) as unknown as typeof base;
        expect(() => loop(base, invalidStep)).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
    });
    test("rejects legacy array selection syntax at runtime", () => {
        const users = createUsersTable();
        expect(() => pipe(users, map((user) => ([user.id] as never)))).toThrow(LEGACY_SELECTION_ARRAY_ERROR);
    });
    test("rejects invalid select helper usage", () => {
        const users = createUsersTable();
        expect(() => pipe(users, select((user) => [
            user.id,
            pipe(user.name, alias("id")),
        ]))).toThrow(SELECT_DUPLICATE_COLUMN_ERROR);
        expect(() => alias("")).toThrow(SELECT_ALIAS_EMPTY_ERROR);
        expect(() => pipe(users, select([
            alias("bad") as never,
        ]))).toThrow(SELECT_INVALID_SELECTION_ERROR);
    });
    test("rejects non-canonical built-in dialect names", () => {
        const users = createUsersTable();
        expect(() => toSql(pipe(users, map((user) => ({ id: user.id }))), { dialect: "PostgreSQL" })).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
    });
    test("rejects empty values() inputs", () => {
        expect(() => values([] as unknown as [{ id: number }])).toThrow(VALUES_EMPTY_ERROR);
    });
    test("rejects values() rows with mismatched columns", () => {
        expect(() => values([
            { id: 1, name: "Ada" },
            { id: 2, email: "grace@example.com" } as unknown as { id: number; name: string },
        ])).toThrow(VALUES_COLUMN_MISMATCH_ERROR);
    });
    test("user-facing errors expose stable error codes", () => {
        const users = createUsersTable();
        try {
            pipe(users, map((user) => ({
                bad: group(user.id),
            })));
            throw new Error("Expected map() to throw");
        }
        catch (error) {
            expect(error).toBeInstanceOf(TetaUserError);
            expect((error as TetaUserError).code).toBe("GROUP_OUTSIDE_AGGREGATE");
            expect((error as TetaUserError).kind).toBe("user");
        }
    });
});
