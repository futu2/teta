import { describe, expect, test } from "bun:test";
import {
  exprToSql,
  exprToSqlResult,
  ir,
  irToSql,
  irToSqlResult,
  type ExprNode,
  type QueryIR,
} from "../mod.ts";

const idColumn = {
  kind: "column",
  table: "users_0",
  name: "id",
} satisfies ExprNode<number>;

const simpleIR = {
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "__teta_scope_test" as QueryIR["scopeId"],
  columnNames: ["id"],
  columnIdentifiers: {
    id: { name: "id", quoted: false },
  },
  withs: [],
} satisfies QueryIR & {
  columnNames: readonly string[];
  columnIdentifiers: Record<string, { name: string; quoted: boolean }>;
  withs: [];
};

describe("sql backend renderer", () => {
  test("renders expression IR directly", () => {
    expect(exprToSql(idColumn, { dialect: "postgresql" })).toBe("users_0.id");
    expect(exprToSqlResult(idColumn, { dialect: "postgresql" })).toEqual({
      sql: "users_0.id",
      params: [],
    });
  });

  test("renders query IR directly", () => {
    ir.validateQueryIR(simpleIR);
    expect(irToSql(simpleIR, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id FROM users AS users_0"
    );
    expect(irToSqlResult(simpleIR, { dialect: "postgresql", format: "compact" })).toEqual({
      sql: "SELECT users_0.id FROM users AS users_0",
      params: [],
    });
  });
});
