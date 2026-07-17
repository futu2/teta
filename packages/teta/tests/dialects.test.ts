import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";
import { BUILTIN_DIALECTS } from "@teta/sql";
import type { BuiltinDialect } from "@teta/sql";
import { pipe, t, table, take, toSql } from "../mod.ts";
import { DIALECT_MATRIX_SQL } from "./helpers/expected-sql.ts";
import { buildDialectMatrixQuery } from "./helpers/fixtures.ts";
const DIALECTS = ["postgresql", "mysql", "duckdb", "sqlite"] as const;
const PARSER_DATABASES = {
    postgresql: "Postgresql",
    mysql: "MySQL",
    duckdb: "Postgresql",
    sqlite: "SQLite",
} as const;
describe("dialect SQL generation", () => {
    for (const dialect of DIALECTS) {
        test(`renders expected ${dialect} SQL`, () => {
            const sql = toSql(buildDialectMatrixQuery(), { dialect, format: "compact" });
            expect(sql).toBe(DIALECT_MATRIX_SQL[dialect]);
        });
        test(`parses generated ${dialect} SQL`, () => {
            const sql = toSql(buildDialectMatrixQuery(), { dialect, format: "compact" });
            const parser = new Parser();
            expect(() => parser.astify(sql, { database: PARSER_DATABASES[dialect] })).not.toThrow();
        });
    }

    test("renders and parses a limited query for every registered built-in dialect", () => {
        const users = table("users", { id: t.int() });
        const query = pipe(users, take(1));
        const parser = new Parser();
        for (const dialect of Object.keys(BUILTIN_DIALECTS) as BuiltinDialect[]) {
            const sql = toSql(query, { dialect });
            expect(sql).toContain("SELECT");
            expect(() => parser.astify(sql, {
                database: BUILTIN_DIALECTS[dialect].parserDialect,
            })).not.toThrow();
        }
    });

    test("lowers take through the target dialect pagination syntax", () => {
        const query = pipe(table("users", { id: t.int() }), take(10));

        expect(toSql(query, { dialect: "db2" })).toBe(
            "SELECT users_0.id AS id FROM users AS users_0 FETCH FIRST 10 ROWS ONLY"
        );
        expect(toSql(query, { dialect: "transactsql" })).toBe(
            "SELECT TOP 10 users_0.id AS id FROM users AS users_0"
        );
        expect(toSql(query, {
            dialect: { name: "warehouse-db2", parserDialect: "DB2" },
        })).toEndWith("FETCH FIRST 10 ROWS ONLY");
        expect(toSql(query, {
            dialect: { name: "warehouse-sql-server", parserDialect: "TransactSQL" },
        })).toStartWith("SELECT TOP 10 ");
    });
});
