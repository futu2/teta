import { describe, expect, test } from "bun:test";

import {
  TetaUserError,
  cast,
  extract,
  param,
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
});
