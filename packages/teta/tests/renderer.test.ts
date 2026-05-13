import { describe, expect, test } from "bun:test";
import { add, and, eq, filter, map, param, t, table, toSql, toSqlResult, pipe } from "../mod.ts";
import {
  DIALECT_MATRIX_SQL,
  EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT,
  EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT,
  PARAMETERIZED_EXPR_POSTGRES_COMPACT,
  PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT,
  USER_PIPELINE_POSTGRES_COMPACT,
} from "./helpers/expected-sql.ts";
import { buildDialectMatrixQuery, buildUserPipelineQuery } from "./helpers/fixtures.ts";

describe("SQL render options API", () => {
  test("toSql(query, options) renders a query", () => {
    const query = buildUserPipelineQuery();
    const sqlOptions = {
      dialect: "postgresql",
      format: "compact",
    } as const;

    expect(toSql(query, sqlOptions)).toBe(USER_PIPELINE_POSTGRES_COMPACT);
  });

  test("toSqlResult(query, options) returns structured SQL output", () => {
    const query = buildUserPipelineQuery();
    const sqlOptions = {
      dialect: "postgresql",
      format: "compact",
    } as const;

    expect(toSqlResult(query, sqlOptions)).toEqual({
      sql: USER_PIPELINE_POSTGRES_COMPACT,
      params: [],
    });
  });

  test("toSqlResult(query, options) can parameterize literals", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const query = pipe(
      users,
      filter((user) => and(eq(user.id, 42), eq(user.name, "Ada"))),
      map((user) => ({ id: user.id }))
    );

    expect(toSqlResult(query, {
      dialect: "postgresql",
      format: "compact",
      parameterMode: "named",
    })).toEqual({
      sql: PARAMETERIZED_USERS_FILTER_POSTGRES_COMPACT,
      params: [
        { value: 42, index: 1, name: "p1" },
        { value: "Ada", index: 2, name: "p2" },
      ],
    });
  });

  test("toSqlResult(query, options) captures explicit params by default", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const name = "SQL injection string ;)";
    const query = pipe(
      users,
      filter((user) => eq(user.name, param(name))),
      map((user) => ({ id: user.id }))
    );

    expect(toSqlResult(query, {
      dialect: "postgresql",
      format: "compact",
    })).toEqual({
      sql: EXPLICIT_PARAM_USERS_FILTER_POSTGRES_COMPACT,
      params: [
        { value: name, index: 1, name: null },
      ],
    });
  });

  test("options can preconfigure dialect behavior", () => {
    const query = buildDialectMatrixQuery();
    const sqlOptions = { dialect: "duckdb", format: "compact" } as const;

    expect(toSql(query, sqlOptions)).toBe(DIALECT_MATRIX_SQL.duckdb);
  });

  test("toSql(expr, options) renders expressions too", () => {
    expect(toSql(add(1, 2), { dialect: "duckdb" })).toBe("1 + 2");
  });

  test("toSqlResult(expr, options) returns structured SQL output", () => {
    expect(toSqlResult(add(1, 2), { dialect: "duckdb" })).toEqual({
      sql: "1 + 2",
      params: [],
    });
  });

  test("toSqlResult(expr, options) can parameterize literals", () => {
    expect(toSqlResult(add(1, 2), {
      dialect: "postgresql",
      format: "compact",
      parameterMode: "named",
    })).toEqual({
      sql: PARAMETERIZED_EXPR_POSTGRES_COMPACT,
      params: [
        { value: 1, index: 1, name: "p1" },
        { value: 2, index: 2, name: "p2" },
      ],
    });
  });

  test("toSqlResult(expr, options) captures explicit params by default", () => {
    expect(toSqlResult(eq(param(1), param(2)), {
      dialect: "postgresql",
      format: "compact",
    })).toEqual({
      sql: EXPLICIT_PARAM_EXPR_POSTGRES_COMPACT,
      params: [
        { value: 1, index: 1, name: null },
        { value: 2, index: 2, name: null },
      ],
    });
  });

  test("toSql(query, options) supports bigint literals on bigint columns", () => {
    const sessions = table("sessions", {
      session_id: t.bigint(),
    });
    const query = pipe(
      sessions,
      filter((session) => eq(session.session_id, 42n)),
      map((session) => ({ session_id: session.session_id }))
    );

    expect(toSql(query, {
      dialect: "postgresql",
      format: "compact",
    })).toBe("SELECT sessions_0.session_id FROM sessions AS sessions_0 WHERE sessions_0.session_id = 42");
  });
});
