import { describe, expect, test } from "bun:test";
import {
  exprToSql,
  exprToSqlResult,
  ir,
  irToSql,
  irToSqlResult,
  type ExprNode,
  type PortableQueryIR,
} from "../mod.ts";

const idColumn = {
  kind: "column",
  table: "users_0",
  name: "id",
} satisfies ExprNode<number>;

const simpleIR = {
  version: 1,
  source: {
    db: null,
    schema: null,
    table: { name: "users", quoted: false },
    as: null,
  },
  stages: [],
  scopeId: "__teta_scope_test" as PortableQueryIR["scopeId"],
  columnNames: ["id"],
  withs: [],
} satisfies PortableQueryIR;

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

  test("derives quoted physical identifiers from portable logical names", () => {
    const userIdIR = {
      version: 1,
      source: {
        db: null,
        schema: null,
        table: { name: "users", quoted: false },
        as: null,
      },
      stages: [],
      scopeId: "__teta_scope_user" as PortableQueryIR["scopeId"],
      columnNames: ["user-id"],
      withs: [],
    } satisfies PortableQueryIR;

    ir.validateQueryIR(userIdIR);
    expect(irToSql(userIdIR, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.\"user-id\" AS \"user-id\" FROM users AS users_0"
    );
  });
});
