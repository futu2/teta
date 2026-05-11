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

  test("strips only redundant identifier quotes", () => {
    expect(
      stripRedundantQuotes('SELECT "users"."name", "select" FROM `orders` JOIN [group] ON "users"."id" = `orders`."user_id"')
    ).toBe(
      'SELECT users.name, "select" FROM orders JOIN [group] ON users.id = orders.user_id'
    );
  });
});
