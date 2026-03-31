import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { toSql } from "../mod.ts";
import { buildLiveDialectQuery } from "./helpers/fixtures.ts";
let database: Database | null = null;
afterEach(() => {
    database?.close();
    database = null;
});
describe("live sqlite dialect", () => {
    test("executes generated SQLite SQL", () => {
        database = new Database(":memory:");
        database.exec(`
      CREATE TABLE users (
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
        database.exec(`
      INSERT INTO users (name, created_at)
      VALUES ('duck', '2024-01-02 03:04:05');
    `);
        const sql = toSql(buildLiveDialectQuery(), { dialect: "sqlite", format: "compact" });
        const row = database
            .query(sql)
            .get() as {
            len: number;
            bit_len: number;
            day: string;
            fmt: string;
        } | null;
        expect(row).toEqual({
            len: 4,
            bit_len: 32,
            day: "2024-01-02 00:00:00",
            fmt: "2024-01-02",
        });
    });
});
