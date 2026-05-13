import { describe, expect, test } from "bun:test";
import { add, charLength, eq, filter, isNotNull, isNull, join, loop, map, not, t, table, toSql, pipe } from "../mod.ts";
import { buildOrgTreeQuery, createEmployeesTable } from "./helpers/fixtures.ts";

describe("recursive loop queries", () => {
  test("renders stable recursive CTE names across separate query instances", () => {
    const sqlOptions = { dialect: "postgresql", format: "compact" } as const;

    const sqlA = toSql(
      pipe(buildOrgTreeQuery(), map((employee) => ({ id: employee.id, name: employee.name }))),
      sqlOptions
    );
    const sqlB = toSql(
      pipe(buildOrgTreeQuery(), map((employee) => ({ id: employee.id, name: employee.name }))),
      sqlOptions
    );

    expect(sqlA).toBe(sqlB);
  });

  test("renders a recursive employee tree CTE", () => {
    const sql = toSql(
      pipe(buildOrgTreeQuery(), map((employee) => ({ id: employee.id, name: employee.name }))),
      { dialect: "postgresql", format: "compact" }
    );

    const match = sql.match(/^WITH RECURSIVE (loop_\d+)\(id, name, manager_id\) AS \(/);
    expect(match).not.toBeNull();
    const loopName = match?.[1];
    expect(loopName).toBeDefined();
    expect(sql).toContain("SELECT employees_0.id, employees_0.name, employees_0.manager_id FROM employees AS employees_0 WHERE employees_0.manager_id IS NULL");
    expect(sql).toContain(`INNER JOIN ${loopName} AS loop_1 ON employees_0.manager_id = loop_1.id`);
    expect(sql).toContain(`SELECT ${loopName}_0.id, ${loopName}_0.name FROM ${loopName} AS ${loopName}_0`);
  });

  test("supports loop(base, step) as the recursive builder", () => {
    const employees = createEmployeesTable();
    const base = pipe(
      employees,
      filter((employee) => isNull(employee.manager_id)),
      map((employee) => ({
        id: employee.id,
        name: employee.name,
        manager_id: employee.manager_id,
      }))
    );

    const sql = toSql(
      pipe(
        loop(
          base,
          (self) => pipe(
            employees,
            join(
              self,
              (employee, current) => eq(employee.manager_id, current.id),
              (employee) => ({
                id: employee.id,
                name: employee.name,
                manager_id: employee.manager_id,
              })
            )
          )
        ),
        map((employee) => ({ id: employee.id, name: employee.name }))
      ),
      { dialect: "postgresql", format: "compact" }
    );

    expect(sql).toContain("WITH RECURSIVE");
    expect(sql).toContain("INNER JOIN");
  });

  test("avoids nested WITH clauses when recursive steps join staged subqueries", () => {
    const orgTree = table("orgTree", {
      orgId: t.int(),
      sup_orgId: t.nullable(t.int()),
    });

    const directSup = pipe(
      orgTree,
      filter((row) => isNotNull(row.sup_orgId)),
      map((row) => ({
        orgId: row.orgId,
        sup_orgId: row.sup_orgId,
        distance: 1,
      }))
    );

    const sql = toSql(
      loop(
        directSup,
        (self) => pipe(
          self,
          join(
            directSup,
            (current, parent) => eq(current.sup_orgId, parent.orgId),
            (current, parent) => ({
              orgId: current.orgId,
              sup_orgId: parent.sup_orgId,
              distance: add(current.distance, 1),
            })
          )
        )
      ),
      { dialect: "postgresql", format: "compact" }
    );

    expect(sql.match(/\bWITH\b/g) ?? []).toHaveLength(1);
    expect(sql).not.toContain("loop_base_");
    expect(sql).toContain('SELECT "orgTree_0"."orgId", "orgTree_0"."sup_orgId", 1 AS distance FROM "orgTree" AS "orgTree_0" WHERE "orgTree_0"."sup_orgId" IS NOT NULL');
  });

  test("avoids internal CTEs for recursive join sources with multiple map stages", () => {
    const orgTree = table("orgTree", {
      stru_id: t.string(),
      sup_stru: t.string(),
    });

    const orgInfo = pipe(
      orgTree,
      map((row) => ({
          stru_id: row.stru_id,
          sup_stru: row.sup_stru,
        })),
      map((row) => ({
          ...row,
          distance: 1,
        })),
      filter((row) => not(eq(charLength(row.sup_stru), 0)))
    );

    const sql = toSql(
      loop(
        orgInfo,
        (self) => pipe(
          self,
          join(
            orgInfo,
            (u, o) => eq(u.sup_stru, o.stru_id),
            (u, o) => ({
              stru_id: u.stru_id,
              sup_stru: o.sup_stru,
              distance: add(o.distance, 1),
            })
          )
        )
      ),
      { dialect: "hetu", format: "compact" }
    );

    expect(sql.match(/\bWITH\b/g) ?? []).toHaveLength(1);
    expect(sql).not.toContain("loop_step_join_cte_");
    expect(sql).not.toContain("INNER JOIN (WITH ");
  });
});
