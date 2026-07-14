import { describe, expect, test } from "bun:test";

import {
  TetaUserError,
  cast,
  dateLiteral,
  extract,
  lit,
  map,
  param,
  pipe,
  t,
  table,
  timestampLiteral,
  toSql,
} from "../mod.ts";
import type { TetaErrorCode } from "../mod.ts";
import { fn, windowFn } from "../advanced.ts";

function expectUserError(action: () => unknown, code: TetaErrorCode): void {
  try {
    action();
    throw new Error("Expected TetaUserError");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).code).toBe(code);
  }
}

describe("SQL token safety", () => {
  test("rejects SQL syntax in custom function names", () => {
    expectUserError(() => fn("ABS); SELECT 1 --", 1), "INVALID_FUNCTION_NAME");
    expectUserError(() => windowFn("ROW_NUMBER); SELECT 1 --"), "INVALID_FUNCTION_NAME");
  });

  test("rejects SQL syntax in cast targets and extract fields", () => {
    expectUserError(() => cast(1, "INTEGER); DROP TABLE users; --"), "INVALID_FUNCTION_NAME");
    expectUserError(() => extract("2025-01-01", "YEAR); SELECT 1 --"), "INVALID_FUNCTION_NAME");
  });

  test("rejects SQL syntax in parameter names", () => {
    expectUserError(() => param("id); SELECT 1 --"), "INVALID_PARAM_NAME");
  });

  test("uses mode-compatible parameter names", () => {
    expect(toSql(param<number>("account_id"), {
      dialect: "postgresql",
      parameterMode: "named",
      params: { account_id: 1 },
    })).toBe(":account_id");

    expect(toSql(param<number>("1"), {
      dialect: "postgresql",
      parameterMode: "positional",
      parameterPrefix: "$",
      params: [1],
    })).toBe("$1");

    expectUserError(
      () => toSql(param<number>("1"), {
        dialect: "postgresql",
        parameterMode: "named",
        params: { 1: 1 },
      }),
      "INVALID_PARAM_NAME"
    );
  });

  test("keeps identifier placeholder text inside literals unchanged", () => {
    const query = pipe(
      table("users", { value: t.string() }),
      map((row) => ({
        "quoted value": row.value,
        literal: "__TETA_QI_0__",
      }))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      `SELECT users_0.value AS "quoted value", '__TETA_QI_0__' AS literal FROM users AS users_0`
    );
  });

  test("escapes adversarial quoted identifiers without rewriting literals", () => {
    const identifier = `x'; SELECT 9; --`;
    const query = pipe(
      table("users", { value: t.string() }),
      map((row) => ({
        [identifier]: row.value,
        literal: identifier,
      }))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      `SELECT users_0.value AS "x'; SELECT 9; --", 'x''; SELECT 9; --' AS literal FROM users AS users_0`
    );
  });

  test("escapes inline string literals for each dialect's backslash rules", () => {
    const value = "x\\'; SELECT 9; --";

    expect(toSql(lit(value), { dialect: "postgresql" })).toBe(
      "E'x\\\\\\'; SELECT 9; --'"
    );
    expect(toSql(lit(value), { dialect: "mysql" })).toBe(
      "'x\\\\''; SELECT 9; --'"
    );
    expect(toSql(lit(value), { dialect: "sqlite" })).toBe(
      "'x\\''; SELECT 9; --'"
    );
    expect(toSql(lit(value), { dialect: "snowflake" })).toBe(
      "'x\\\\''; SELECT 9; --'"
    );
  });

  test("does not strip quoted-looking text from inline string literals", () => {
    const value = "x\\' \"quoted_text\" [bracketed_text] `backticked_text`";

    expect(toSql(lit(value), { dialect: "sqlite" })).toBe(
      "'x\\'' \"quoted_text\" [bracketed_text] `backticked_text`'"
    );
    expect(toSql(lit(value), { dialect: "snowflake" })).toBe(
      "'x\\\\'' \"quoted_text\" [bracketed_text] `backticked_text`'"
    );
    expect(toSql(lit(value), { dialect: "mysql" })).toBe(
      "'x\\\\'' \"quoted_text\" [bracketed_text] `backticked_text`'"
    );
    expect(toSql(lit(value), { dialect: "postgresql" })).toBe(
      "E'x\\\\\\' \"quoted_text\" [bracketed_text] `backticked_text`'"
    );
  });

  test("rejects non-ISO temporal literal payloads", () => {
    expectUserError(
      () => dateLiteral("2026-07-15'; SELECT 9; --"),
      "INVALID_LITERAL_VALUE"
    );
    expectUserError(
      () => timestampLiteral("2026-07-15 12:00:00'; SELECT 9; --"),
      "INVALID_LITERAL_VALUE"
    );
  });
});
