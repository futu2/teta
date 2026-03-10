import { describe, expect, test } from "bun:test";

import { sqlRenderer } from "../mod.ts";
import { buildOrgTreeQuery, createEmployeesTable } from "./helpers/fixtures.ts";

describe("recursive loop queries", () => {
  test("renders stable recursive CTE names across separate query instances", () => {
    const renderer = sqlRenderer({ dialect: "postgresql", format: "compact" });
    const sqlA = buildOrgTreeQuery()
      .select((employee) => ({ id: employee.id, name: employee.name }))
      .toSql(renderer);
    const sqlB = buildOrgTreeQuery()
      .select((employee) => ({ id: employee.id, name: employee.name }))
      .toSql(renderer);

    expect(sqlA).toBe(sqlB);
  });

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
      `INNER JOIN ${loopName} AS loop_1 ON employees_0.manager_id = loop_1.id`
    );
    expect(sql).toContain(
      `SELECT ${loopName}_0.id, ${loopName}_0.name FROM ${loopName} AS ${loopName}_0`
    );
  });

  test("supports `base.loop(step)` as an alias", () => {
    const employees = createEmployeesTable();
    const base = employees
      .filter((employee) => employee.manager_id.isNull())
      .select((employee) => ({
        id: employee.id,
        name: employee.name,
        manager_id: employee.manager_id,
      }));

    const sql = base
      .loop((self) =>
        employees.join(
          self,
          (employee, current) => employee.manager_id.eq(current.id),
          { merge: (employee) => ({
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
          }) }
        )
      )
      .select((employee) => ({ id: employee.id, name: employee.name }))
      .toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }));

    expect(sql).toContain("WITH RECURSIVE");
    expect(sql).toContain("INNER JOIN");
  });
});
