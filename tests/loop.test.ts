import { describe, expect, test } from "bun:test";

import { sqlRenderer } from "../mod.ts";
import { buildOrgTreeQuery } from "./helpers/fixtures.ts";

describe("recursive loop queries", () => {
  test("renders a recursive employee tree CTE", () => {
    const sql = buildOrgTreeQuery()
      .select((employee) => ({ id: employee.id, name: employee.name }))
      .toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }));

    const match = sql.match(/^WITH RECURSIVE (loop_\d+)\(id, name, manager_id\) AS \(/);
    expect(match).not.toBeNull();

    const loopName = match?.[1];
    expect(loopName).toBeDefined();
    expect(sql).toContain(
      "SELECT employees_0.id, employees_0.name, employees_0.manager_id FROM employees AS employees_0 WHERE employees_0.manager_id IS NULL"
    );
    expect(sql).toContain(
      `INNER JOIN ${loopName} AS ${loopName}_1 ON employees_0.manager_id = ${loopName}_1.id`
    );
    expect(sql).toContain(
      `SELECT ${loopName}_0.id, ${loopName}_0.name FROM ${loopName} AS ${loopName}_0`
    );
  });
});
