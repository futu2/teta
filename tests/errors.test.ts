import { describe, expect, test } from "bun:test";
import { TetaUserError, sqlRenderer, fold, join, map, eq, group, loop, toSql, count } from "../mod.ts";
import { GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR, GROUP_OUTSIDE_AGGREGATE_ERROR, LEGACY_SELECTION_ARRAY_ERROR, LOOP_COLUMN_MISMATCH_ERROR, NON_CANONICAL_POSTGRES_DIALECT_ERROR, UNSUPPORTED_CROSS_JOIN_ERROR, } from "./helpers/expected-errors.ts";
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
        expect(() => toSql(map(users, (user) => ({ id: user.id })), sqlRenderer({ dialect: "PostgreSQL" }))).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
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
