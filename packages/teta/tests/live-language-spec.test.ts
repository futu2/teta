import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { toSql, type SqlRenderable } from "../mod.ts";
import { createDuckDbAdapter, createPostgresqlAdapter, createSqliteAdapter, normalizeLiveRows, type LiveDialect, type LiveDialectAdapter } from "./helpers/live-db.ts";
import { LIVE_LANGUAGE_SPEC_CASES, type LiveOutcome } from "./helpers/live-language-spec.ts";

let DuckDBConnection:
  | (typeof import("@duckdb/node-api"))["DuckDBConnection"]
  | null = null;
let PGlite: (typeof import("@electric-sql/pglite"))["PGlite"] | null = null;

try {
  ({ DuckDBConnection } = await import("@duckdb/node-api"));
} catch {
  DuckDBConnection = null;
}

try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  PGlite = null;
}

function isErrorOutcome(outcome: LiveOutcome): outcome is { error: RegExp } {
  return "error" in outcome;
}

async function runCase(
  adapterFactory: () => Promise<LiveDialectAdapter>,
  dialect: LiveDialect,
  outcome: LiveOutcome,
  build: () => SqlRenderable
): Promise<void> {
  const adapter = await adapterFactory();
  try {
    await runCaseWithAdapter(adapter, dialect, outcome, build);
  } finally {
    await adapter.close();
  }
}

async function runCaseWithAdapter(
  adapter: LiveDialectAdapter,
  dialect: LiveDialect,
  outcome: LiveOutcome,
  build: () => SqlRenderable
): Promise<void> {
  const sql = toSql(build(), { dialect, format: "compact" });
  if (isErrorOutcome(outcome)) {
    await expect(adapter.run(sql)).rejects.toThrow(outcome.error);
    return;
  }

  const rows = normalizeLiveRows(await adapter.run(sql));
  expect(rows).toEqual(outcome.rows);
}

describe("live language spec coverage", () => {
  describe("sqlite", () => {
    for (const specCase of LIVE_LANGUAGE_SPEC_CASES) {
      test(specCase.name, async () => {
        await runCase(
          createSqliteAdapter,
          "sqlite",
          specCase.outcomes.sqlite,
          specCase.build
        );
      });
    }
  });

  describe("duckdb", () => {
    const liveDuckDbTest = DuckDBConnection ? test : test.skip;

    for (const specCase of LIVE_LANGUAGE_SPEC_CASES) {
      liveDuckDbTest(specCase.name, async () => {
        if (!DuckDBConnection) {
          throw new Error("DuckDBConnection is unavailable");
        }

        await runCase(
          () => createDuckDbAdapter(DuckDBConnection),
          "duckdb",
          specCase.outcomes.duckdb,
          specCase.build
        );
      });
    }
  });

  describe("postgresql", () => {
    const livePostgresqlTest = PGlite ? test.concurrent : test.skip;
    let postgresqlAdapter: LiveDialectAdapter | null = null;

    beforeAll(async () => {
      if (PGlite) {
        postgresqlAdapter = await createPostgresqlAdapter(PGlite);
      }
    });

    afterAll(async () => {
      await postgresqlAdapter?.close();
      postgresqlAdapter = null;
    });

    for (const specCase of LIVE_LANGUAGE_SPEC_CASES) {
      livePostgresqlTest(specCase.name, async () => {
        if (!postgresqlAdapter) {
          throw new Error("PostgreSQL adapter is unavailable");
        }

        await runCaseWithAdapter(
          postgresqlAdapter,
          "postgresql",
          specCase.outcomes.postgresql,
          specCase.build
        );
      });
    }
  });
});
