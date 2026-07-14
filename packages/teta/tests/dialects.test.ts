import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";
import { BUILTIN_DIALECTS } from "@teta/sql";
import { t, table, toSql } from "../mod.ts";
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

    test("renders a portable query for every registered built-in dialect", () => {
        const users = table("users", { id: t.int() });
        for (const dialect of Object.keys(BUILTIN_DIALECTS)) {
            expect(toSql(users, { dialect })).toContain("SELECT");
        }
    });
});
