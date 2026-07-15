import { describe, expect, test } from "bun:test";

import {
  buildSqlOptions,
  resolveDialect,
  resolveDialectLanguage,
} from "../src/dialect.ts";
import { TetaUserError } from "../src/errors.ts";

function expectUserError(
  action: () => unknown,
  code: "INVALID_BUILTIN_DIALECT_NAME" | "INVALID_RENDERER_OPTIONS" | "INVALID_FUNCTION_NAME",
  message: string
): void {
  try {
    action();
    throw new Error("Expected TetaUserError");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).code).toBe(code);
    expect((error as TetaUserError).message).toBe(message);
  }
}

describe("dialect resolution", () => {
  test("rejects unregistered string dialects", () => {
    expectUserError(
      () => resolveDialect("hetu" as never),
      "INVALID_BUILTIN_DIALECT_NAME",
      "Unknown built-in dialect 'hetu'. Use a canonical built-in name or a DialectSpec."
    );
  });

  test("inherits parser dialect features for custom specs", () => {
    expect(
      resolveDialect({
        name: "custom",
        parserDialect: "BigQuery",
      })
    ).toMatchObject({
      name: "custom",
      parserDialect: "BigQuery",
      features: {
        lateralJoinKeyword: true,
        recursiveCte: true,
        qualifyClause: true,
      },
    });
  });

  test("buildSqlOptions applies dialect and parameter defaults", () => {
    expect(
      buildSqlOptions({
        dialect: { name: "custom", parserDialect: "Postgresql" },
        format: "pretty",
        parameterMode: "named",
        parameterPrefix: "$",
      })
    ).toMatchObject({
      sqlFormat: "pretty",
      parameterMode: "named",
      parameterPrefix: "$",
      dialect: {
        name: "custom",
        parserDialect: "Postgresql",
      },
      options: {
        database: "Postgresql",
      },
    });
  });

  test("rejects erased parameter modes and prefixes", () => {
    expectUserError(
      () => buildSqlOptions({ parameterMode: "named); SELECT 1 --" } as never),
      "INVALID_RENDERER_OPTIONS",
      "parameterMode must be inline, named, or positional"
    );
    expectUserError(
      () => buildSqlOptions({ parameterPrefix: ":x); SELECT 1 --" } as never),
      "INVALID_RENDERER_OPTIONS",
      "parameterPrefix must be one of :, $, or @"
    );
  });

  test("rejects unsafe dialect function mappings during resolution", () => {
    expectUserError(
      () => resolveDialectLanguage("custom", {
        functions: { UPPER: "evil); SELECT 1 --" },
      }),
      "INVALID_FUNCTION_NAME",
      "function mapping for UPPER must be a dot-separated SQL identifier"
    );
  });
});
