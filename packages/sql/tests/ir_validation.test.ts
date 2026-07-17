import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  BUILTIN_FUNCTION_ARITIES,
  BUILTIN_FUNCTION_OPERATIONS,
  TETA_QUERY_IR_VERSION,
  TetaUserError,
  exprToSql,
  irToSql,
  lowerPortableQueryIR,
  validateExprIR,
  validateQueryIR,
  type ExprNode,
  type PortableQueryIR,
  type PortableQuerySpec,
} from "../mod.ts";

function assertReadonlyIrTypes(target: PortableQueryIR, expr: ExprNode<unknown>): void {
  // @ts-expect-error portable query roots are readonly
  target.scopeId = "__teta_scope_mutated";
  // @ts-expect-error portable stage collections are readonly
  target.stages.push({ kind: "take", count: 1, projectAll: [] });
  if (expr.kind === "builtin") {
    // @ts-expect-error nested expression collections are readonly
    expr.args.push({ kind: "literal", value: 1 });
  }
  // @ts-expect-error expression discriminants are readonly
  expr.kind = "literal";
}

void assertReadonlyIrTypes;

function validTarget(): PortableQueryIR {
  return {
    version: TETA_QUERY_IR_VERSION,
    source: {
      db: null,
      schema: null,
      table: { name: "users", quoted: false },
      as: null,
    },
    stages: [],
    scopeId: "__teta_scope_users",
    columnNames: ["id"],
    withs: [],
  };
}

function validTableJoinTarget(): PortableQueryIR {
  const usersScope = "__teta_scope_users";
  const ordersScope = "__teta_scope_orders";
  return {
    version: TETA_QUERY_IR_VERSION,
    source: {
      db: null,
      schema: null,
      table: { name: "users", quoted: false },
      as: null,
    },
    stages: [{
      kind: "join",
      joinType: "INNER",
      lateral: false,
      source: {
        kind: "table",
        db: null,
        schema: null,
        table: { name: "orders", quoted: false },
        columnNames: ["id", "user_id"],
      },
      as: "orders_1",
      on: {
        kind: "binary",
        op: "=",
        left: { kind: "column", table: usersScope, name: "id" },
        right: { kind: "column", table: ordersScope, name: "id" },
      },
      projectAll: [
        { expr: { kind: "column", table: usersScope, name: "id" }, as: null },
        { expr: { kind: "column", table: ordersScope, name: "user_id" }, as: null },
      ],
      rightScopeId: ordersScope,
      outputScopeId: "__teta_scope_joined",
    }],
    scopeId: usersScope,
    columnNames: ["id", "user_id"],
  };
}

function validQuerySpec(
  scopeId: string,
  columnNames: readonly string[] = ["id"]
): PortableQuerySpec {
  return {
    source: {
      db: null,
      schema: null,
      table: { name: "rows", quoted: false },
      as: null,
    },
    stages: [],
    scopeId,
    columnNames,
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

  test("validates and renders a distinct stage", () => {
    const target: PortableQueryIR = {
      ...validTarget(),
      stages: [{
        kind: "distinct",
        projectAll: [{
          expr: { kind: "column", table: "__teta_scope_users", name: "id" },
          as: null,
        }],
      }],
    };

    validateQueryIR(target);
    expect(irToSql(target, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT DISTINCT users_0.id AS id FROM users AS users_0"
    );
  });

  test("preserves prototype-named columns through portable lowering and rendering", () => {
    const columnNames = ["__proto__", "constructor", "toString"];
    const target = {
      version: TETA_QUERY_IR_VERSION,
      source: {
        kind: "values",
        rows: [Object.fromEntries(columnNames.map((name, index) => [name, index + 1]))],
      },
      stages: [],
      scopeId: "__teta_scope_values",
      columnNames,
    } satisfies PortableQueryIR;

    validateQueryIR(target);
    const lowered = lowerPortableQueryIR(target);
    expect(Object.getPrototypeOf(lowered.columnIdentifiers)).toBeNull();
    expect(Object.keys(lowered.columnIdentifiers)).toEqual(columnNames);
    for (const name of columnNames) {
      expect(Object.hasOwn(lowered.columnIdentifiers, name)).toBe(true);
      expect(lowered.columnIdentifiers[name]?.name).toBe(name);
    }
    expect(irToSql(target, { dialect: "postgresql" })).toBe(
      "SELECT values_0.__proto__, values_0.constructor, values_0.\"toString\" "
      + "FROM (SELECT 1 AS __proto__, 2 AS constructor, 3 AS \"toString\") AS values_0"
    );
  });

  test("rejects old or incomplete portable targets at the boundary", () => {
    const oldVersion = { ...validTarget(), version: 0 };
    expectInvalid(() => validateQueryIR(oldVersion), "query.version");
    expectInvalid(() => irToSql(oldVersion as never, { dialect: "postgresql" }), "query.version");

    const missingMetadata = { ...validTarget() } as Record<string, unknown>;
    delete missingMetadata.columnNames;
    expectInvalid(() => irToSql(missingMetadata as never, { dialect: "postgresql" }), "query.columnNames");
  });

  test("rejects renderer metadata and SQL syntax in raw IR", () => {
    const rendererMetadata = {
      ...validTarget(),
      columnIdentifiers: {},
    };
    expectInvalid(() => validateQueryIR(rendererMetadata), "query.columnIdentifiers");

    expect(lowerPortableQueryIR(validTarget()).columnIdentifiers).toEqual({
      id: { name: "id", quoted: false },
    });

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

  test("lowers semantic table-join columns into renderer identifiers", () => {
    const target = validTableJoinTarget();
    validateQueryIR(target);
    const stage = lowerPortableQueryIR(target).stages[0];
    expect(stage?.kind).toBe("join");
    if (!stage || stage.kind !== "join" || stage.source.kind !== "table") {
      throw new Error("Expected a lowered table join");
    }
    expect(stage.source.columnIdentifiers).toEqual({
      id: { name: "id", quoted: false },
      user_id: { name: "user_id", quoted: false },
    });

    const missingColumns = structuredClone(target) as Record<string, any>;
    delete missingColumns.stages[0].source.columnNames;
    expectInvalid(() => validateQueryIR(missingColumns), "query.stages[0].source.columnNames");
  });

  test("enforces scope and column visibility across stages", () => {
    expectInvalid(() => validateQueryIR({
      ...validTarget(),
      stages: [{
        kind: "map",
        items: [{
          expr: { kind: "column", table: "__teta_scope_missing", name: "id" },
          as: null,
        }],
        keys: ["id"],
        groupBy: null,
        outputScopeId: "__teta_scope_result",
      }],
    }), "query.stages[0].items[0].expr.table");

    expectInvalid(() => validateQueryIR({
      ...validTarget(),
      stages: [
        {
          kind: "map",
          items: [{
            expr: { kind: "column", table: "__teta_scope_users", name: "id" },
            as: null,
          }],
          keys: ["id"],
          groupBy: null,
          outputScopeId: "__teta_scope_result",
        },
        {
          kind: "filter",
          predicate: {
            kind: "binary",
            op: "=",
            left: { kind: "column", table: "__teta_scope_users", name: "id" },
            right: { kind: "literal", value: 1 },
          },
          projectAll: [{
            expr: { kind: "column", table: "__teta_scope_result", name: "id" },
            as: null,
          }],
        },
      ],
    }), "query.stages[1].predicate.left.table");

    const unknownJoinColumn = structuredClone(validTableJoinTarget()) as Record<string, any>;
    unknownJoinColumn.stages[0].on.right.name = "missing";
    expectInvalid(
      () => validateQueryIR(unknownJoinColumn),
      "query.stages[0].on.right.name"
    );
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
      "query.stages[0].items"
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

    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        stages: [{
          kind: "map",
          items: [{
            expr: { kind: "literal", value: 1 },
            as: { name: "actual_id", quoted: false },
          }],
          keys: ["claimed_id"],
          groupBy: null,
          outputScopeId: "__teta_scope_result",
        }],
      }),
      "query.stages[0].keys"
    );

    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        columnNames: ["different_id"],
        stages: [{
          kind: "map",
          items: [{
            expr: { kind: "literal", value: 1 },
            as: { name: "id", quoted: false },
          }],
          keys: ["id"],
          groupBy: null,
          outputScopeId: "__teta_scope_result",
        }],
      }),
      "query.columnNames"
    );
  });

  test("enforces WITH-list and recursive CTE column invariants", () => {
    const first = {
      kind: "query" as const,
      name: "shared_rows",
      query: validQuerySpec("__teta_scope_first"),
    };
    const second = {
      kind: "query" as const,
      name: "shared_rows",
      query: validQuerySpec("__teta_scope_second"),
    };
    expectInvalid(
      () => validateQueryIR({ ...validTarget(), withs: [first, second] }),
      "query.withs[1].name"
    );

    const recursive = {
      kind: "recursive" as const,
      name: "recursive_rows",
      columnNames: ["id"],
      base: validQuerySpec("__teta_scope_base"),
      step: validQuerySpec("__teta_scope_step"),
    };
    validateQueryIR({ ...validTarget(), withs: [recursive] });

    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        withs: [{
          ...recursive,
          base: validQuerySpec("__teta_scope_base", ["other_id"]),
        }],
      }),
      "query.withs[0].base.columnNames"
    );
    expectInvalid(
      () => validateQueryIR({
        ...validTarget(),
        withs: [{
          ...recursive,
          step: validQuerySpec("__teta_scope_step", ["other_id"]),
        }],
      }),
      "query.withs[0].step.columnNames"
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

  test("validates and renders cataloged built-in operations", () => {
    const builtin = {
      kind: "builtin",
      op: "UPPER",
      args: [{ kind: "literal", value: "ada" }],
    } as const;

    validateExprIR(builtin);
    expect(exprToSql(builtin, { dialect: "postgresql" })).toBe("upper('ada')");
    expectInvalid(
      () => validateExprIR({ ...builtin, op: "DATABASE_ONLY_FUNCTION" } as never),
      "op"
    );
    expectInvalid(
      () => validateExprIR({ ...builtin, op: "upper" } as never),
      "op"
    );
  });

  test("accepts every declared portable scalar operation", () => {
    for (const op of BUILTIN_FUNCTION_OPERATIONS) {
      const { min } = BUILTIN_FUNCTION_ARITIES[op];
      validateExprIR({
        kind: "builtin",
        op,
        args: Array.from({ length: min }, () => ({ kind: "literal", value: null })),
      });
    }
  });

  test("rejects invalid portable builtin arities", () => {
    expectInvalid(
      () => validateExprIR({ kind: "builtin", op: "UPPER", args: [] }),
      "UPPER expects exactly 1 argument"
    );
    expectInvalid(
      () => validateExprIR({
        kind: "builtin",
        op: "DATE_ADD",
        args: [{ kind: "literal", value: "2025-01-01" }],
      }),
      "DATE_ADD expects exactly 3 arguments"
    );
  });

  test("keeps the published JSON Schema synchronized with portable IR", () => {
    const schemaPath = fileURLToPath(new URL("../ir.v1.schema.json", import.meta.url));
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      required: string[];
      $defs: { builtinOperation: { enum: string[] } };
    };

    expect(schema.required).not.toContain("columnIdentifiers");
    expect(schema.$defs.builtinOperation.enum).toEqual([...BUILTIN_FUNCTION_OPERATIONS]);
  });
});
