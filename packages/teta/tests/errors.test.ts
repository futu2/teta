import { describe, expect, test } from "bun:test";
import { TetaUserError, asc, count, distinct, eq, filter, fold, group, inner, join, left, loop, map, onEq, prefixOverlapLeft, sort, t, table, take, takeWithin, toSql, unlessStep, unnest, usingCols, values, whenStep, pipe } from "../mod.ts";
import type { TetaErrorCode } from "../mod.ts";
import { GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR, GROUP_OUTSIDE_AGGREGATE_ERROR, JOIN_MERGE_CONFLICT_ERROR, JOIN_OVERLAPPING_COLUMNS_ERROR, LEGACY_SELECTION_ARRAY_ERROR, LOOP_COLUMN_MISMATCH_ERROR, NON_CANONICAL_POSTGRES_DIALECT_ERROR, TABLE_SCHEMA_EMPTY_ERROR, TABLE_SCHEMA_INVALID_ERROR, VALUES_COLUMN_MISMATCH_ERROR, VALUES_EMPTY_ERROR, VALUES_NO_COLUMNS_ERROR, VALUES_ROW_INVALID_ERROR, VALUES_UNDEFINED_ERROR } from "./helpers/expected-errors.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("error paths", () => {
    function expectUserError(fn: () => unknown, code: TetaErrorCode, message: string): void {
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
  test("rejects erased row columns outside aggregates in fold", () => {
    const users = createUsersTable();
    expectUserError(
      () => pipe(users, fold(() => ({ bad: users.columns.id } as never))),
      "GROUP_OUTSIDE_AGGREGATE",
      "fold() expressions must be wrapped in group() or used inside an aggregate"
    );
  });
  test("rejects group() inside fold functions", () => {
        const users = createUsersTable();
        expect(() => pipe(users, fold((user) => ({
            bad: count(group(user.id)),
        })))).toThrow(GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR);
    });
    test("renderSql rejects query targets without a scope id with a user error", () => {
        expectUserError(
            () => toSql({
                source: {
                    db: null,
                    schema: null,
                    table: { name: "users", quoted: false },
                    as: null,
                },
                stages: [],
                columnNames: ["id"],
            } as never),
            "QUERY_SQL_TARGET_MISSING_SCOPE",
            "Query SQL target is missing scopeId"
        );
    });
    test("query helpers validate only current curried shapes", () => {
        expect(() => (map as any)()).toThrow("map() expects map(selector)");
        expect(() => (filter as any)("not a callback")).toThrow("filter() expects a row callback");
        expect(() => (take as any)()).toThrow("take() expects take(count)");
    });
    test("take rejects invalid counts", () => {
        for (const count of [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
            expectUserError(
                () => take(count),
                "QUERY_HELPER_INVALID_ARGUMENTS",
                "take() expects a finite non-negative integer count"
            );
        }
    });
    test("conditional step helpers validate erased conditions and step brands", () => {
        for (const [name, helper] of [["whenStep", whenStep], ["unlessStep", unlessStep]] as const) {
            const message = `${name}() expects ${name}(condition, step)`;
            expectUserError(
                () => (helper as any)("yes", take(1)),
                "QUERY_HELPER_INVALID_ARGUMENTS",
                message
            );
            expectUserError(
                () => (helper as any)(false, (query: unknown) => query),
                "QUERY_HELPER_INVALID_ARGUMENTS",
                message
            );
        }
    });
    test("takeWithin validates erased callback outputs", () => {
        const users = createUsersTable();

        expectUserError(
            () => pipe(users, takeWithin({
                partitionBy: () => "name" as never,
                orderBy: (user) => asc(user.id),
                count: 1,
            })),
            "DEFERRED_INPUT_INVALID",
            "takeWithin.partitionBy() callback must return expression(s)"
        );
        expectUserError(
            () => pipe(users, takeWithin({
                partitionBy: (user) => user.name,
                orderBy: () => "name" as never,
                count: 1,
            })),
            "DEFERRED_INPUT_INVALID",
            "takeWithin.orderBy() callback must return order item(s)"
        );
    });
    test("join-spec builders reject invalid options without probing callbacks", () => {
        const users = table("users", { id: t.int() });
        const orders = table("orders", { user_id: t.int() });
        const on = (_user: typeof users.columns, _order: typeof orders.columns) => {
            throw new Error("callback should not be executed during argument validation");
        };
        expect(() => (left as any)(on, { type: "left" })).toThrow(
            "left() options must be { lateral?: boolean }"
        );
    });
    test("join-spec builders validate erased calls and return frozen values", () => {
        const users = table("users", { id: t.int() });
        const orders = table("orders", { user_id: t.int() });
        const on = (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id);

        expect(() => (left as any)()).toThrow("left() expects left(on, select?, options?)");
        expect(() => (left as any)(on, { lateral: "yes" })).toThrow(
            "left() options must be { lateral?: boolean }"
        );
        expect(Object.isFrozen(left(on))).toBe(true);
    });
    test("join rejects invalid right operands", () => {
        const users = table("users", { id: t.int() });
        const on = (_user: typeof users.columns, _right: typeof users.columns) => eq(_user.id, _right.id);
        const selector = (_user: typeof users.columns, _right: typeof users.columns) => ({ id: _user.id });

        expect(() => (join as any)("not a query", left(on as any))).toThrow(
            "join() expects join(right, spec)"
        );
        expect(() => (join as any)("not a query", inner(on, selector))).toThrow(
            "join() expects join(right, spec)"
        );
    });
    test("join rejects uppercase type options at the EDSL boundary", () => {
        const orders = createOrdersTable();
        expectUserError(
            () => join(orders, {
                type: "LEFT" as never,
                on: () => {
                    throw new Error("callback should not be executed during argument validation");
                },
            }),
            "DEFERRED_INPUT_INVALID",
            "join() spec.type must be inner, left, right, or full"
        );
    });
    test("rejects default joins with overlapping output columns", () => {
        const users = createUsersTable();
        const profiles = values([
            { id: 1, bio: "A" },
            { id: 2, bio: "B" },
        ]);
        expect(() => pipe(
            users,
            (join as any)(profiles, {
                type: "inner",
                on: ((user: typeof users.columns, profile: typeof profiles.columns) => eq(user.id, profile.id)) as any,
            })
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
            (join as any)(profiles, {
                type: "inner",
                on: ((user: typeof users.columns, profile: typeof profiles.columns) => eq(user.id, profile.user_id)) as any,
                select: prefixOverlapLeft("user_"),
            })
        )).toThrow(JOIN_MERGE_CONFLICT_ERROR);
    });
    test("query helpers reject malformed current API calls at runtime", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => (map as any)(users, (user: typeof users.columns) => ({ id: user.id })),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "map() expects map(selector)"
        );
        expectUserError(
            () => (filter as any)(users, (user: typeof users.columns) => eq(user.id, 1)),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "filter() expects filter(predicate)"
        );
        expectUserError(
            () => (fold as any)(orders, (order: typeof orders.columns) => ({
                user_id: group(order.user_id),
                total: count(order.order_id),
            })),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "fold() expects fold(selector)"
        );
        expectUserError(
            () => (sort as any)(users, (user: typeof users.columns) => user.id),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "sort() expects sort(selector)"
        );
        expectUserError(
            () => (take as any)(users, 10),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "take() expects take(count)"
        );
    });

    test("unnest rejects non-expression selector results", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });

        expectUserError(
            () => pipe(sessions, unnest(() => ["not", "expr"] as any, { value: "tag" })),
            "DEFERRED_INPUT_INVALID",
            "unnest() callback must return an expression"
        );
    });
    test("unnest validates selection and options before deriving queries", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });

        expectUserError(
            () => unnest((session: typeof sessions.columns) => session.tags, undefined as never),
            "DEFERRED_INPUT_INVALID",
            "unnest() selection must be { value: string, ordinality?: string }"
        );
        expectUserError(
            () => unnest((session: typeof sessions.columns) => session.tags, { value: "" }),
            "DEFERRED_INPUT_INVALID",
            "unnest() selection.value must be a non-empty string"
        );
        expectUserError(
            () => unnest((session: typeof sessions.columns) => session.tags, { value: "tag", ordinality: "tag" }),
            "DEFERRED_INPUT_INVALID",
            "unnest() selection column names must be distinct"
        );
        expectUserError(
            () => unnest((session: typeof sessions.columns) => session.tags, { value: "tag" }, { outer: "yes" } as never),
            "DEFERRED_INPUT_INVALID",
            "unnest() options must be { outer?: boolean }"
        );
    });
    test("join column helpers report dynamic unknown columns", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();

        expectUserError(
            () => pipe(users, join(orders, inner(
                usingCols("missing" as never),
                (user, order) => ({ id: user.id, order_id: order.order_id })
            ))),
            "JOIN_MERGE_UNKNOWN_COLUMN",
            "Unknown join column 'missing'. Available columns: id, name"
        );
        expectUserError(
            () => pipe(users, join(orders, inner(
                onEq({ id: "missing" } as never),
                (user, order) => ({ id: user.id, order_id: order.order_id })
            ))),
            "JOIN_MERGE_UNKNOWN_COLUMN",
            "Unknown join column 'missing'. Available columns: order_id, user_id, total"
        );
    });
    test("rejects loop steps with mismatched column names", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const base = pipe(users, map((user) => ({ id: user.id })));
        const invalidStep = () => pipe(orders, map((order) => ({
            user_id: order.user_id,
        }))) as unknown as typeof base;
        expect(() => pipe(base, loop(invalidStep))).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
    });
    test("rejects legacy array selection syntax at runtime", () => {
        const users = createUsersTable();
        expect(() => pipe(users, map((user) => ([user.id] as never)))).toThrow(LEGACY_SELECTION_ARRAY_ERROR);
    });
    test("rejects erased invalid map and fold selectors with user errors", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => pipe(users, map(undefined as never)),
            "DEFERRED_INPUT_INVALID",
            "map() expects a row callback"
        );
        expectUserError(
            () => pipe(orders, fold({} as never)),
            "DEFERRED_INPUT_INVALID",
            "fold() expects a row callback"
        );
    });
    test("distinct rejects arguments", () => {
        expectUserError(
            () => (distinct as any)("name"),
            "QUERY_HELPER_INVALID_ARGUMENTS",
            "distinct() expects distinct()"
        );
    });
    test("rejects erased invalid map and fold callback returns with user errors", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        expectUserError(
            () => pipe(users, map(() => undefined as never)),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
        expectUserError(
            () => pipe(orders, fold(() => undefined as never)),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
        expectUserError(
            () => pipe(users, map(() => new Date() as never)),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
        expectUserError(
            () => pipe(orders, fold(() => new Date() as never)),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
        expectUserError(
            () => pipe(users, map(() => ({} as never))),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
        expectUserError(
            () => pipe(orders, fold(() => ({} as never))),
            "LEGACY_SELECTION_ARRAY",
            LEGACY_SELECTION_ARRAY_ERROR
        );
    });
    test("rejects non-canonical and unregistered built-in dialect names", () => {
        const users = createUsersTable();
        expect(() => toSql(pipe(users, map((user) => ({ id: user.id }))), { dialect: "PostgreSQL" as never })).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
        expectUserError(
            () => toSql(users, { dialect: "hetu" as never }),
            "INVALID_BUILTIN_DIALECT_NAME",
            "Unknown built-in dialect 'hetu'. Use a canonical built-in name or a DialectSpec."
        );
    });
    test("rejects empty values() inputs", () => {
        expect(() => values([] as unknown as [{ id: number }])).toThrow(VALUES_EMPTY_ERROR);
    });
    test("rejects values() rows without columns", () => {
        expect(() => values([{}] as unknown as [{ id: number }])).toThrow(VALUES_NO_COLUMNS_ERROR);
    });
    test("rejects erased non-object values() rows with a user error", () => {
        expectUserError(
            () => values([null] as never),
            "VALUES_ROW_INVALID",
            VALUES_ROW_INVALID_ERROR
        );
    });
    test("rejects values() undefined cells", () => {
        expect(() => values([{ id: undefined }] as unknown as [{ id: number }])).toThrow(VALUES_UNDEFINED_ERROR);
    });
    test("rejects non-finite values() number literals at the frontend boundary", () => {
        expectUserError(
            () => values([{ id: Number.NaN }]),
            "INVALID_LITERAL_VALUE",
            "Unsupported literal value: NaN"
        );
    });
    test("rejects values() rows with mismatched columns", () => {
        expect(() => values([
            { id: 1, name: "Ada" },
            { id: 2, email: "grace@example.com" } as unknown as { id: number; name: string },
        ])).toThrow(VALUES_COLUMN_MISMATCH_ERROR);
    });
    test("rejects erased invalid table schemas", () => {
        expect(() => table("empty", {} as never)).toThrow(TABLE_SCHEMA_EMPTY_ERROR);
        expect(() => table("bad_rows", { payload: {} } as never)).toThrow(TABLE_SCHEMA_INVALID_ERROR);
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
