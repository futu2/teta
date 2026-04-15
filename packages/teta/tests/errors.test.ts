import { describe, expect, test } from "bun:test";
import { TetaUserError, count, eq, fold, group, join, loop, map, toSql, values } from "../mod.ts";
import { GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR, GROUP_OUTSIDE_AGGREGATE_ERROR, JOIN_OVERLAPPING_COLUMNS_ERROR, LEGACY_JOIN_MERGE_OPTION_ERROR, LEGACY_SELECTION_ARRAY_ERROR, LOOP_COLUMN_MISMATCH_ERROR, NON_CANONICAL_POSTGRES_DIALECT_ERROR, UNSUPPORTED_CROSS_JOIN_ERROR, VALUES_COLUMN_MISMATCH_ERROR, VALUES_EMPTY_ERROR } from "./helpers/expected-errors.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("error paths", () => {
    test("rejects group() outside fold", () => {
        const users = createUsersTable();
        expect(() => map(users, (user) => ({
            bad: group(user.id),
        }))).toThrow(GROUP_OUTSIDE_AGGREGATE_ERROR);
    });
    test("rejects group() inside fold functions", () => {
        const users = createUsersTable();
        expect(() => fold(users, (user) => ({
            bad: count(group(user.id)),
        }))).toThrow(GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR);
    });
    test("rejects unsupported join types through the query API", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expect(() => join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "cross" as never })).toThrow(UNSUPPORTED_CROSS_JOIN_ERROR);
    });
    test("rejects legacy join merge options at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expect(() => join(users, orders, (user, order) => eq(user.id, order.user_id), {
            merge: (user: typeof users.columns, order: typeof orders.columns) => ({
                id: user.id,
                total: order.total,
            }),
        } as never)).toThrow(LEGACY_JOIN_MERGE_OPTION_ERROR);
    });
    test("rejects default joins with overlapping output columns", () => {
        const users = createUsersTable();
        const profiles = values([
            { id: 1, bio: "A" },
            { id: 2, bio: "B" },
        ]);
        expect(() => join(users, profiles, (user, profile) => eq(user.id, profile.id))).toThrow(JOIN_OVERLAPPING_COLUMNS_ERROR);
    });
    test("rejects loop steps with mismatched column names", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const base = map(users, (user) => ({ id: user.id }));
        const invalidStep = () => map(orders, (order) => ({
            user_id: order.user_id,
        })) as unknown as typeof base;
        expect(() => loop(base, invalidStep)).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
    });
    test("rejects legacy array selection syntax at runtime", () => {
        const users = createUsersTable();
        expect(() => map(users, (user) => ([user.id] as never))).toThrow(LEGACY_SELECTION_ARRAY_ERROR);
    });
    test("rejects non-canonical built-in dialect names", () => {
        const users = createUsersTable();
        expect(() => toSql(map(users, (user) => ({ id: user.id })), { dialect: "PostgreSQL" })).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
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
            map(users, (user) => ({
                bad: group(user.id),
            }));
            throw new Error("Expected map() to throw");
        }
        catch (error) {
            expect(error).toBeInstanceOf(TetaUserError);
            expect((error as TetaUserError).code).toBe("GROUP_OUTSIDE_AGGREGATE");
            expect((error as TetaUserError).kind).toBe("user");
        }
    });
});
