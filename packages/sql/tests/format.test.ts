import { describe, expect, test } from "bun:test";

import {
  formatSqlPretty,
  stripRedundantQuotes,
} from "../src/render/format.ts";

describe("format helpers", () => {
  test("pretty formats WITH clauses across lines", () => {
    const sql =
      "WITH cte_a AS (SELECT 1), cte_b AS (SELECT 2) SELECT * FROM cte_a INNER JOIN cte_b ON cte_a.id = cte_b.id";

    expect(formatSqlPretty(sql)).toBe([
      "WITH",
      "  cte_a AS (",
      "    SELECT 1),",
      "  cte_b AS (",
      "    SELECT 2)",
      "SELECT *",
      "FROM cte_a",
      "INNER JOIN cte_b",
      "ON cte_a.id = cte_b.id",
    ].join("\n"));
  });

  test("pretty formats DB2 pagination clauses", () => {
    expect(formatSqlPretty(
      "SELECT users.id FROM users ORDER BY users.id FETCH FIRST 10 ROWS ONLY"
    )).toBe([
      "SELECT users.id",
      "FROM users",
      "ORDER BY users.id",
      "FETCH FIRST 10 ROWS ONLY",
    ].join("\n"));
  });

  test("strips only redundant identifier quotes", () => {
    expect(
      stripRedundantQuotes('SELECT "users"."name", "select" FROM `orders` JOIN [group] ON "users"."id" = `orders`."user_id"')
    ).toBe(
      'SELECT users.name, "select" FROM orders JOIN [group] ON users.id = orders.user_id'
    );
  });

  test("does not inspect SQL literals or comments while stripping quotes", () => {
    const sql = [
      `SELECT '"users"."name"', '__TETA_QI_0__', "users"."name"`,
      `-- "commented_identifier"`,
      `/* [hidden_identifier] */ SELECT $tag$"quoted_text"$tag$, \`orders\`."id"`,
    ].join("\n");

    expect(stripRedundantQuotes(sql)).toBe([
      `SELECT '"users"."name"', '__TETA_QI_0__', users.name`,
      `-- "commented_identifier"`,
      `/* [hidden_identifier] */ SELECT $tag$"quoted_text"$tag$, orders.id`,
    ].join("\n"));
  });

  test("preserves quoted-looking text after a backslash and doubled apostrophe", () => {
    const sql = `SELECT 'x\\'' "quoted_text" [bracketed_text] \`backticked_text\`', "value"`;

    expect(stripRedundantQuotes(sql)).toBe(
      `SELECT 'x\\'' "quoted_text" [bracketed_text] \`backticked_text\`', value`
    );
  });
});
