import { describe, expect, test } from "bun:test";
import nodeSqlParser from "node-sql-parser";
import {
  TetaUserError,
  applyDialectLanguage,
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

const literal = (value: number): ExprNode<number> => ({
  kind: "literal",
  value,
});

const namedParam = (name: string): ExprNode<number> => ({
  kind: "param",
  name,
});

const add = (
  left: ExprNode<number>,
  right: ExprNode<number>
): ExprNode<number> => ({
  kind: "binary",
  op: "+",
  left,
  right,
});

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

  test("reserves an explicit parameter name emitted before an automatic parameter", () => {
    expect(exprToSqlResult(add(namedParam("p1"), literal(2)), {
      dialect: "postgresql",
      format: "compact",
      parameterMode: "named",
      params: { p1: 1 },
    })).toEqual({
      sql: ":p1 + :p2",
      params: [
        { value: 1, index: 1, name: "p1" },
        { value: 2, index: 2, name: "p2" },
      ],
    });
  });

  test("reserves a repeated explicit parameter name emitted after an automatic parameter", () => {
    expect(exprToSqlResult(
      add(add(literal(2), namedParam("p1")), namedParam("p1")),
      {
        dialect: "postgresql",
        format: "compact",
        parameterMode: "named",
        params: { p1: 1 },
      }
    )).toEqual({
      sql: ":p2 + :p1 + :p1",
      params: [
        { value: 2, index: 1, name: "p2" },
        { value: 1, index: 2, name: "p1" },
        { value: 1, index: 3, name: "p1" },
      ],
    });
  });

  test("reserves root-stage parameters before rendering CTE literals", () => {
    const rootScope = "__teta_scope_root";
    const cteScope = "__teta_scope_cte";
    const target = {
      ...simpleIR,
      source: {
        db: null,
        schema: null,
        table: { name: "audit_cte", quoted: false },
        as: null,
      },
      scopeId: rootScope,
      stages: [{
        kind: "filter",
        predicate: { kind: "param", name: "p1" },
        projectAll: [{
          expr: { kind: "column", table: rootScope, name: "id" },
          as: null,
        }],
      }],
      withs: [{
        kind: "query",
        name: "audit_cte",
        query: {
          source: {
            db: null,
            schema: null,
            table: { name: "audit", quoted: false },
            as: null,
          },
          stages: [{
            kind: "filter",
            predicate: { kind: "literal", value: true },
            projectAll: [{
              expr: { kind: "column", table: cteScope, name: "id" },
              as: null,
            }],
          }],
          scopeId: cteScope,
          columnNames: ["id"],
        },
      }],
    } satisfies PortableQueryIR;

    expect(irToSqlResult(target, {
      dialect: "postgresql",
      format: "compact",
      parameterMode: "named",
      params: { p1: false },
    })).toEqual({
      sql: "WITH audit_cte(id) AS (SELECT audit_0.id AS id FROM audit AS audit_0 WHERE :p2) "
        + "SELECT audit_cte_0.id AS id FROM audit_cte AS audit_cte_0 WHERE :p1",
      params: [
        { value: true, index: 1, name: "p2" },
        { value: false, index: 2, name: "p1" },
      ],
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

  test("escapes embedded BigQuery identifier backticks with a parseable hex escape", () => {
    const columnName = "event\\path`type";
    const target = {
      ...simpleIR,
      columnNames: [columnName],
    } satisfies PortableQueryIR;

    const sql = irToSql(target, { dialect: "bigquery", format: "compact" });
    expect(sql).toBe(
      "SELECT users_0.`event\\\\path\\x60type` AS `event\\\\path\\x60type` FROM users AS users_0"
    );

    const { Parser } = nodeSqlParser;
    expect(() => new Parser().astify(sql, { database: "BigQuery" })).not.toThrow();
  });

  test("renders safe custom function mappings", () => {
    expect(exprToSql(
      {
        kind: "builtin",
        op: "UPPER",
        args: [{ kind: "literal", value: "ada" }],
      },
      {
        dialect: {
          name: "custom",
          language: { functions: { UPPER: "app.safe_upper" } },
        },
      }
    )).toBe("app.safe_upper('ada')");
  });

  test("rejects unsafe function mappings from resolved dialect values", () => {
    const dialect = {
      name: "custom",
      parserDialect: null,
      features: {
        lateralJoinKeyword: true,
        recursiveCte: true,
        qualifyClause: false,
      },
      language: {
        functions: { UPPER: "evil); SELECT 1 --" },
        fallbacks: {},
        unsupported: [],
      },
    };

    try {
      applyDialectLanguage({
        kind: "builtin",
        op: "UPPER",
        args: [{ kind: "literal", value: "ada" }],
      }, dialect);
      throw new Error("Expected TetaUserError");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("INVALID_FUNCTION_NAME");
      expect((error as TetaUserError).message).toBe(
        "function mapping for UPPER must be a dot-separated SQL identifier"
      );
    }
  });
});
