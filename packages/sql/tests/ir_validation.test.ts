import { describe, expect, test } from "bun:test";

import {
  TETA_QUERY_IR_VERSION,
  TetaUserError,
  exprToSql,
  irToSql,
  validateExprIR,
  validateQueryIR,
  type QueryIRSqlTarget,
} from "../mod.ts";

function validTarget(): QueryIRSqlTarget {
  return {
    version: TETA_QUERY_IR_VERSION,
    source: {
      db: null,
      schema: null,
      table: { name: "users", quoted: false },
      as: null,
    },
    stages: [],
    scopeId: "__teta_scope_users" as QueryIRSqlTarget["scopeId"],
    columnNames: ["id"],
    columnIdentifiers: {
      id: { name: "id", quoted: false },
    },
    withs: [],
  };
}

function expectInvalid(action: () => unknown, fragment: string): void {
  try {
    action();
    throw new Error("Expected invalid IR to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).code).toBe("INVALID_QUERY_IR");
    expect((error as TetaUserError).message).toContain(fragment);
  }
}

describe("public query IR v1", () => {
  test("renders a validated versioned target", () => {
    const target = validTarget();
    validateQueryIR(target);
    expect(irToSql(target, { dialect: "postgresql" })).toBe(
      "SELECT users_0.id FROM users AS users_0"
    );
  });

  test("rejects old or incomplete renderer targets at the boundary", () => {
    const oldVersion = { ...validTarget(), version: 0 };
    expectInvalid(() => validateQueryIR(oldVersion), "query.version");
    expectInvalid(() => irToSql(oldVersion as never, { dialect: "postgresql" }), "query.version");

    const missingMetadata = { ...validTarget() } as Record<string, unknown>;
    delete missingMetadata.columnNames;
    expectInvalid(() => irToSql(missingMetadata as never, { dialect: "postgresql" }), "query.columnNames");
  });

  test("rejects malformed column metadata and SQL syntax in raw IR", () => {
    const missingIdentifier = {
      ...validTarget(),
      columnIdentifiers: {},
    };
    expectInvalid(() => validateQueryIR(missingIdentifier), "query.columnIdentifiers");

    const unsafeFunction = {
      ...validTarget(),
      stages: [{
        kind: "map",
        keys: ["id"],
        groupBy: null,
        outputScopeId: "__teta_scope_result",
        items: [{
          expr: { kind: "func", name: "ABS); SELECT 1 --", args: [] },
          as: { name: "id", quoted: false },
        }],
      }],
    };
    expectInvalid(() => irToSql(unsafeFunction as never, { dialect: "postgresql" }), "name");
  });

  test("rejects properties outside the v1 contract at every decoder boundary", () => {
    expectInvalid(
      () => validateQueryIR({ ...validTarget(), debug: true }),
      "query.debug"
    );

    const targetWithExtraStageProperty = {
      ...validTarget(),
      stages: [{
        kind: "map",
        items: [{
          expr: { kind: "literal", value: 1 },
          as: { name: "id", quoted: false },
        }],
        keys: ["id"],
        groupBy: null,
        outputScopeId: "__teta_scope_result",
        plannerHint: "not part of IR v1",
      }],
    };
    expectInvalid(
      () => irToSql(targetWithExtraStageProperty as never, { dialect: "postgresql" }),
      "query.stages[0].plannerHint"
    );

    expectInvalid(
      () => exprToSql({ kind: "literal", value: 1, source: "outside IR v1" } as never),
      "expression.source"
    );
  });

  test("enforces schema cardinality and metadata invariants at runtime", () => {
    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        stages: [{
          kind: "map",
          items: [],
          keys: [],
          groupBy: null,
          outputScopeId: "__teta_scope_result",
        }],
      }),
      "query.stages[0].keys"
    );

    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        stages: [{
          kind: "unnest",
          mode: "inner",
          expr: { kind: "literal", value: null },
          withOrdinality: false,
          as: null,
          columnNames: [],
          columnIdentifiers: {},
          projectAll: [],
          rightScopeId: "__teta_scope_unnest",
          outputScopeId: "__teta_scope_result",
        }],
      }),
      "query.stages[0].columnNames"
    );

    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        source: { kind: "values", rows: [{ "": 1 }] },
      }),
      "query.source.rows[0] key"
    );
  });

  test("validates standalone expression IR before stringification", () => {
    expectInvalid(
      () => exprToSql({ kind: "cast", expr: { kind: "literal", value: 1 }, target: "INTEGER); SELECT 1 --" } as never),
      "target"
    );

    const bigint = { kind: "literal", value: { kind: "bigint_literal", value: "9007199254740993" } } as const;
    validateExprIR(bigint);
    expect(exprToSql(bigint, { dialect: "postgresql" })).toBe("9007199254740993");
  });
});
