import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";

import { sqlRenderer } from "../mod.ts";
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
      const sql = buildDialectMatrixQuery()
        .toSql(sqlRenderer({ dialect, format: "compact" }));
      expect(sql).toBe(DIALECT_MATRIX_SQL[dialect]);
    });

    test(`parses generated ${dialect} SQL`, () => {
      const sql = buildDialectMatrixQuery()
        .toSql(sqlRenderer({ dialect, format: "compact" }));
      const parser = new Parser();

      expect(() =>
        parser.astify(sql, { database: PARSER_DATABASES[dialect] })
      ).not.toThrow();
    });
  }
});
