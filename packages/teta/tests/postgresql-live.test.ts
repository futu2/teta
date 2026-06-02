import { afterEach, describe, expect, test } from "bun:test";
import { asTimestamp, dateFormat, map, table, t, toSql, pipe } from "../mod.ts";
import { buildLiveDialectQuery } from "./helpers/fixtures.ts";

let PGlite: (typeof import("@electric-sql/pglite"))["PGlite"] | null = null;

try {
    ({ PGlite } = await import("@electric-sql/pglite"));
}
catch {
    PGlite = null;
}

let database: Awaited<ReturnType<Exclude<typeof PGlite, null>["create"]>> | null = null;

afterEach(async () => {
    await database?.close();
    database = null;
});

const livePostgresqlTest = PGlite ? test : test.skip;

describe("live postgresql dialect", () => {
    livePostgresqlTest("executes generated PostgreSQL SQL", async () => {
        if (!PGlite) {
            throw new Error("PGlite is unavailable");
        }
        database = await PGlite.create("memory://");
        await database.query("SET TIME ZONE 'UTC'");
        await database.query(`
      CREATE TABLE users (
        name VARCHAR NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
    `);
        await database.query(`
      INSERT INTO users (name, created_at)
      VALUES ('duck', TIMESTAMP '2024-01-02 03:04:05');
    `);
        const sql = toSql(buildLiveDialectQuery(), { dialect: "postgresql", format: "compact" });
        const [row] = (await database.query(sql)).rows as Array<{
            len: number | bigint;
            bit_len: number | bigint;
            day: Date;
            fmt: string;
        }>;
        expect({
            len: Number(row?.len),
            bit_len: Number(row?.bit_len),
            day: row?.day instanceof Date
                ? {
                    year: row.day.getFullYear(),
                    month: row.day.getMonth() + 1,
                    date: row.day.getDate(),
                    hours: row.day.getHours(),
                    minutes: row.day.getMinutes(),
                    seconds: row.day.getSeconds(),
                }
                : row?.day,
            fmt: row?.fmt,
        }).toEqual({
            len: 4,
            bit_len: 32,
            day: {
                year: 2024,
                month: 1,
                date: 2,
                hours: 0,
                minutes: 0,
                seconds: 0,
            },
            fmt: "2024-01-02",
        });
    });

    livePostgresqlTest("executes TIMESTAMP cast helper SQL", async () => {
        if (!PGlite) {
            throw new Error("PGlite is unavailable");
        }
        database = await PGlite.create("memory://");
        await database.query("SET TIME ZONE 'UTC'");
        await database.query(`
      CREATE TABLE events (
        event_date DATE NOT NULL
      );
    `);
        await database.query(`
      INSERT INTO events (event_date)
      VALUES (DATE '2024-01-02');
    `);
        const events = table("events", {
            event_date: t.date(),
        });
        const query = pipe(events, map((event) => ({
            event_ts: dateFormat(asTimestamp(event.event_date), "%Y-%m-%d %H:%M:%S"),
        })));
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        const rows = (await database.query(sql)).rows;
        expect(rows).toEqual([{ event_ts: "2024-01-02 00:00:00" }]);
    });
});
