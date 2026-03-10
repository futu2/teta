import { describe, expect, test } from "bun:test";
import { add, duckdbRenderer, param, sqlRenderer, table, t, eq, filter, toSql, toSqlResult, select, and } from "../mod.ts";
import { DIALECT_MATRIX_SQL, EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT, EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT, PARAMETERIZED_EXPR_POSTGRES_COMPACT, PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT, USER_PIPELINE_POSTGRES_COMPACT, } from "./helpers/expected-sql.ts";
import { buildDialectMatrixQuery, buildUserPipelineQuery, } from "./helpers/fixtures.ts";
describe("renderer API", () => {
    test("toSql(query, renderer) delegates to renderer state", () => {
        const query = buildUserPipelineQuery();
        const renderer = sqlRenderer({
            dialect: "postgresql",
            format: "compact",
        });
        expect(toSql(query, renderer)).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("toSqlResult(query, renderer) returns structured SQL output", () => {
        const query = buildUserPipelineQuery();
        const renderer = sqlRenderer({
            dialect: "postgresql",
            format: "compact",
        });
        expect(toSqlResult(query, renderer)).toEqual({
            sql: USER_PIPELINE_POSTGRES_COMPACT,
            params: [],
        });
    });
    test("toSqlResult(query, renderer) can parameterize literals", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const query = select(filter(users, (user) => and(eq(user.id, 42), eq(user.name, "Ada"))), (user) => ({ id: user.id }));
        expect(toSqlResult(query, sqlRenderer({
            dialect: "postgresql",
            format: "compact",
            parameterMode: "named",
        }))).toEqual({
            sql: PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT,
            params: [
                { value: 42, index: 1, name: "p1" },
                { value: "Ada", index: 2, name: "p2" },
            ],
        });
    });
    test("toSqlResult(query, renderer) captures explicit params by default", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const name = "SQL injection string ;)";
        const query = select(filter(users, (user) => eq(user.name, param(name))), (user) => ({ id: user.id }));
        expect(toSqlResult(query, sqlRenderer({
            dialect: "postgresql",
            format: "compact",
        }))).toEqual({
            sql: EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT,
            params: [
                { value: name, index: 1, name: null },
            ],
        });
    });
    test("dialect factory renderers preconfigure dialect behavior", () => {
        const query = buildDialectMatrixQuery();
        const renderer = duckdbRenderer({ format: "compact" });
        expect(toSql(query, renderer)).toBe(DIALECT_MATRIX_SQL.duckdb);
    });
    test("toSql(expr, renderer) uses the same renderer state", () => {
        expect(toSql(add(1, 2), duckdbRenderer())).toBe("1 + 2");
    });
    test("toSqlResult(expr, renderer) returns structured SQL output", () => {
        expect(toSqlResult(add(1, 2), duckdbRenderer())).toEqual({
            sql: "1 + 2",
            params: [],
        });
    });
    test("toSqlResult(expr, renderer) can parameterize literals", () => {
        expect(toSqlResult(add(1, 2), sqlRenderer({
            dialect: "postgresql",
            format: "compact",
            parameterMode: "named",
        }))).toEqual({
            sql: PARAMETERIZED_EXPR_POSTGRES_COMPACT,
            params: [
                { value: 1, index: 1, name: "p1" },
                { value: 2, index: 2, name: "p2" },
            ],
        });
    });
    test("toSqlResult(expr, renderer) captures explicit params by default", () => {
        expect(toSqlResult(eq(param(1), param(2)), sqlRenderer({
            dialect: "postgresql",
            format: "compact",
        }))).toEqual({
            sql: EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT,
            params: [
                { value: 1, index: 1, name: null },
                { value: 2, index: 2, name: null },
            ],
        });
    });
    test("toSql(query, renderer) supports bigint literals on bigint columns", () => {
        const sessions = table("sessions", {
            session_id: t.bigint(),
        });
        const query = select(filter(sessions, (session) => eq(session.session_id, 42n)), (session) => ({ session_id: session.session_id }));
        expect(toSql(query, sqlRenderer({
            dialect: "postgresql",
            format: "compact",
        }))).toBe("SELECT sessions_0.session_id FROM sessions AS sessions_0 WHERE sessions_0.session_id = 42");
    });
});
