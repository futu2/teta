import { describe, expect, test } from "bun:test";

import {
  createDuckDbAdapter,
  createSqliteAdapter,
  normalizeLiveRows,
  type LiveDialect,
  type LiveDialectAdapter,
} from "./helpers/live-db.ts";
import {
  LIVE_LANGUAGE_SPEC_CASES,
  type LiveOutcome,
} from "./helpers/live-language-spec.ts";

let DuckDBConnection:
  | (typeof import("@duckdb/node-api"))["DuckDBConnection"]
  | null = null;

try {
  ({ DuckDBConnection } = await import("@duckdb/node-api"));
} catch {
  DuckDBConnection = null;
}

function isErrorOutcome(outcome: LiveOutcome): outcome is { error: RegExp } {
  return "error" in outcome;
}

async function runCase(
  adapterFactory: () => Promise<LiveDialectAdapter>,
  dialect: LiveDialect,
  outcome: LiveOutcome,
  build: () => { toSql: (dialect: LiveDialect, format: "compact") => string }
): Promise<void> {
  const adapter = await adapterFactory();
  try {
    const sql = build().toSql(dialect, "compact");
    if (isErrorOutcome(outcome)) {
      await expect(adapter.run(sql)).rejects.toThrow(outcome.error);
      return;
    }

    const rows = normalizeLiveRows(await adapter.run(sql));
    expect(rows).toEqual(outcome.rows);
  } finally {
    await adapter.close();
  }
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
});
