import { describe, expect, test } from "bun:test";

import {
  add,
  duckdbRenderer,
  param,
  sqlRenderer,
  table,
  t,
} from "../mod.ts";
import {
  DIALECT_MATRIX_SQL,
  EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT,
  EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT,
  PARAMETERIZED_EXPR_POSTGRES_COMPACT,
  PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT,
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

  test("Query.toSqlResult can parameterize literals", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const query = users
      .filter((user) => user.id.eq(42).and(user.name.eq("Ada")))
      .select((user) => ({ id: user.id }));

    expect(
      query.toSqlResult(
        sqlRenderer({
          dialect: "postgresql",
          format: "compact",
          parameterMode: "named",
        })
      )
    ).toEqual({
      sql: PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT,
      params: [
        { value: 42, index: 1, name: "p1" },
        { value: "Ada", index: 2, name: "p2" },
      ],
    });
  });

  test("Query.toSqlResult captures explicit params by default", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const name = "SQL injection string ;)";
    const query = users
      .filter((user) => user.name.eq(param(name)))
      .select((user) => ({ id: user.id }));

    expect(
      query.toSqlResult(
        sqlRenderer({
          dialect: "postgresql",
          format: "compact",
        })
      )
    ).toEqual({
      sql: EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT,
      params: [
        { value: name, index: 1, name: null },
      ],
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

  test("ExprRef.toSqlResult can parameterize literals", () => {
    expect(
      add(1, 2).toSqlResult(
        sqlRenderer({
          dialect: "postgresql",
          format: "compact",
          parameterMode: "named",
        })
      )
    ).toEqual({
      sql: PARAMETERIZED_EXPR_POSTGRES_COMPACT,
      params: [
        { value: 1, index: 1, name: "p1" },
        { value: 2, index: 2, name: "p2" },
      ],
    });
  });

  test("ExprRef.toSqlResult captures explicit params by default", () => {
    expect(
      param(1).eq(param(2)).toSqlResult(
        sqlRenderer({
          dialect: "postgresql",
          format: "compact",
        })
      )
    ).toEqual({
      sql: EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT,
      params: [
        { value: 1, index: 1, name: null },
        { value: 2, index: 2, name: null },
      ],
    });
  });
});
