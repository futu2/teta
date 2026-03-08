import { describe, expect, test } from "bun:test";

import {
  add,
  duckdbRenderer,
  sqlRenderer,
} from "../mod.ts";
import {
  DIALECT_MATRIX_SQL,
  USER_PIPELINE_POSTGRES_COMPACT,
} from "./helpers/expected-sql.ts";
import {
  buildDialectMatrixQuery,
  buildUserPipelineQuery,
} from "./helpers/fixtures.ts";

describe("renderer API", () => {
  test("Query.toSql delegates to renderer objects", () => {
    const query = buildUserPipelineQuery();
    const renderer = sqlRenderer({
      dialect: "postgresql",
      format: "compact",
    });

    expect(query.toSql(renderer)).toBe(USER_PIPELINE_POSTGRES_COMPACT);
  });

  test("Query.toSqlResult returns structured SQL output", () => {
    const query = buildUserPipelineQuery();
    const renderer = sqlRenderer({
      dialect: "postgresql",
      format: "compact",
    });

    expect(query.toSqlResult(renderer)).toEqual({
      sql: USER_PIPELINE_POSTGRES_COMPACT,
      params: [],
    });
  });

  test("dialect factory renderers preconfigure dialect behavior", () => {
    const query = buildDialectMatrixQuery();
    const renderer = duckdbRenderer({ format: "compact" });

    expect(query.toSql(renderer)).toBe(DIALECT_MATRIX_SQL.duckdb);
  });

  test("ExprRef.toSql uses the same renderer interface", () => {
    expect(add(1, 2).toSql(duckdbRenderer())).toBe("1 + 2");
  });

  test("ExprRef.toSqlResult returns structured SQL output", () => {
    expect(add(1, 2).toSqlResult(duckdbRenderer())).toEqual({
      sql: "1 + 2",
      params: [],
    });
  });
});
