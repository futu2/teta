import { describe, expect, test } from "bun:test";

import { renderPipelineAst } from "../mod.ts";
import type { QueryIRSqlTarget, ScopeId } from "../mod.ts";

const usersScope = "__teta_scope_users" as ScopeId;
const usersMapScope = "__teta_scope_users_map" as ScopeId;
const usersFinalScope = "__teta_scope_users_final" as ScopeId;
const baseUsersScope = "__teta_scope_base_users" as ScopeId;

const usersIR = {
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [
    {
      kind: "map",
      items: [
        {
          expr: {
            kind: "column",
            table: usersScope,
            name: "id",
          },
          as: null,
        },
        {
          expr: {
            kind: "func",
            name: "REPLACE",
            args: [
              {
                kind: "column",
                table: usersScope,
                name: "name",
              },
              { kind: "literal", value: " " },
              { kind: "literal", value: "_" },
            ],
          },
          as: { name: "normalized_name", quoted: false },
        },
      ],
      keys: ["id", "normalized_name"],
      groupBy: null,
      outputScopeId: usersMapScope,
    },
    {
      kind: "map",
      items: [
        {
          expr: {
            kind: "column",
            table: usersMapScope,
            name: "id",
          },
          as: null,
        },
      ],
      keys: ["id"],
      groupBy: null,
      outputScopeId: usersFinalScope,
    },
  ],
  scopeId: usersScope,
  columnNames: ["id"],
  columnIdentifiers: {
    id: { name: "id", quoted: false },
  },
  withs: [],
} satisfies QueryIRSqlTarget;

const baseIR = {
  source: {
    db: null,
    schema: null,
    table: { name: "base_users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: baseUsersScope,
  columnNames: ["id"],
  columnIdentifiers: {
    id: { name: "id", quoted: false },
  },
  withs: [],
} satisfies QueryIRSqlTarget;

describe("pipeline render pipeline", () => {
  test("drops unused base CTEs before attaching generated stage CTEs", () => {
    const ast = renderPipelineAst(usersIR.source, usersIR.stages, usersIR.columnNames, usersIR.scopeId, {
      ctePrefix: "test_",
      baseCtes: [
        {
          kind: "query",
          name: "seed",
          query: {
            source: baseIR.source,
            stages: baseIR.stages,
            columnNames: baseIR.columnNames,
            columnIdentifiers: baseIR.columnIdentifiers,
            scopeId: baseIR.scopeId,
          },
        },
      ],
    }) as any;

    expect(ast.with).toHaveLength(1);
    expect(ast.with[0].name.value).toBe("test_cte_0");
    expect(ast.with.map((cte: any) => cte.name.value)).not.toContain("seed");
  });
});
