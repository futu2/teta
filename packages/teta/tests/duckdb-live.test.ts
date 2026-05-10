import { afterEach, describe, expect, test } from "bun:test";
import { pipe } from "remeda";
import { dateFormat, map, table, t, toSql, toTimestamp } from "../mod.ts";
import { buildLiveDialectQuery } from "./helpers/fixtures.ts";
let DuckDBConnection: (typeof import("@duckdb/node-api"))["DuckDBConnection"] | null = null;
try {
    ({ DuckDBConnection } = await import("@duckdb/node-api"));
}
catch {
    DuckDBConnection = null;
}
let connection: InstanceType<Exclude<typeof DuckDBConnection, null>> | null = null;
afterEach(() => {
    connection?.disconnectSync();
    connection = null;
});
const liveDuckDbTest = DuckDBConnection ? test : test.skip;
describe("live duckdb dialect", () => {
    liveDuckDbTest("executes generated DuckDB SQL", async () => {
        if (!DuckDBConnection) {
            throw new Error("DuckDBConnection is unavailable");
        }
        connection = await DuckDBConnection.create();
        await connection.run(`
      CREATE TABLE users (
        name VARCHAR NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
    `);
        await connection.run(`
      INSERT INTO users (name, created_at)
      VALUES ('duck', TIMESTAMP '2024-01-02 03:04:05');
    `);
        const sql = toSql(buildLiveDialectQuery(), { dialect: "duckdb", format: "compact" });
        const rows = await (await connection.run(sql)).getRowObjectsJS();
        const [row] = rows as Array<{
            len: number | bigint;
            bit_len: number | bigint;
            day: Date;
            fmt: string;
        }>;
        expect({
            len: Number(row?.len),
            bit_len: Number(row?.bit_len),
            day: row?.day,
            fmt: row?.fmt,
        }).toEqual({
            len: 4,
            bit_len: 32,
            day: new Date("2024-01-02T00:00:00.000Z"),
            fmt: "2024-01-02",
        });
    });
    liveDuckDbTest("executes TIMESTAMP cast helper SQL", async () => {
        if (!DuckDBConnection) {
            throw new Error("DuckDBConnection is unavailable");
        }
        connection = await DuckDBConnection.create();
        await connection.run("SET TimeZone = 'UTC'");
        await connection.run(`
      CREATE TABLE events (
        event_date DATE NOT NULL
      );
    `);
        await connection.run(`
      INSERT INTO events (event_date)
      VALUES (DATE '2024-01-02');
    `);
        const events = table("events", {
            event_date: t.date(),
        });
        const query = pipe(events, map((event) => ({
            event_ts: dateFormat(toTimestamp(event.event_date), "%Y-%m-%d %H:%M:%S"),
        })));
        const sql = toSql(query, { dialect: "duckdb", format: "compact" });
        const rows = await (await connection.run(sql)).getRowObjectsJS();
        expect(rows).toEqual([{ event_ts: "2024-01-02 00:00:00" }]);
    });
});
