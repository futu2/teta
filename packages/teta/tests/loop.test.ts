import { describe, expect, test } from "bun:test";
import { add, charLength, eq, filter, gt, inner, join, isNotNull, isNull, loop, map, not, t, table, toSql, union, pipe } from "../mod.ts";
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

    const match = sql.match(/^WITH RECURSIVE (recursive_\d+)\(id, name, manager_id\) AS \(/);
    expect(match).not.toBeNull();
    const loopName = match?.[1];
    expect(loopName).toBeDefined();
    expect(sql).toContain("SELECT employees_0.id, employees_0.name, employees_0.manager_id FROM employees AS employees_0 WHERE employees_0.manager_id IS NULL");
    expect(sql).toContain(`INNER JOIN ${loopName} AS recursive_1 ON employees_0.manager_id = recursive_1.id`);
    expect(sql).toContain(`SELECT ${loopName}_0.id, ${loopName}_0.name FROM ${loopName} AS ${loopName}_0`);
  });

  test("quotes recursive CTE header identifiers structurally", () => {
    const base = pipe(
      table("users", { id: t.int(), name: t.string() }),
      map((user) => ({
        ["User Id"]: user.id,
        ["display-name"]: user.name,
        MixedCase: user.id,
      }))
    );

    const sql = toSql(
      pipe(
        base,
        loop((self) => pipe(self, filter((row) => gt(row["User Id"], 0))))
      ),
      { dialect: "postgresql", format: "compact" }
    );

    expect(sql).toStartWith(
      'WITH RECURSIVE recursive_0("User Id", "display-name", "MixedCase") AS ('
    );
    expect(sql).toContain('recursive_0_0."User Id"');
  });

  test("composes independently-created loops with distinct CTE names", () => {
    const left = pipe(
      table("left_nodes", { id: t.int() }),
      loop((self) => pipe(self, filter((row) => gt(row.id, 0))))
    );
    const right = pipe(
      table("right_nodes", { id: t.int() }),
      loop((self) => pipe(self, filter((row) => gt(row.id, 1))))
    );

    const sql = toSql(pipe(left, union(right)), {
      dialect: "postgresql",
      format: "compact",
    });

    expect(sql).toContain("recursive_0(id) AS");
    expect(sql).toContain("recursive_1(id) AS");
    expect(sql).toContain("FROM recursive_0 AS recursive_0_0 UNION SELECT recursive_1_0.id FROM recursive_1 AS recursive_1_0");

    const joinedSql = toSql(
      pipe(
        left,
        join(
          right,
          inner(
            (leftRow, rightRow) => eq(leftRow.id, rightRow.id),
            (leftRow) => ({ id: leftRow.id })
          )
        )
      ),
      { dialect: "postgresql", format: "compact" }
    );

    expect(joinedSql).toContain("recursive_0(id) AS");
    expect(joinedSql).toContain("recursive_1(id) AS");
    expect(joinedSql).toContain("INNER JOIN recursive_1 AS recursive_1 ON");
  });

  test("supports loop(step) as the recursive builder", () => {
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
        base,
        loop((self) => pipe(
            employees,
            join(
              self,
              inner(
                (employee, current) => eq(employee.manager_id, current.id),
                (employee) => ({
                id: employee.id,
                name: employee.name,
                manager_id: employee.manager_id,
                })
              )
            )
          )),
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
      pipe(
        directSup,
        loop((self) => pipe(
          self,
          join(
            directSup,
            inner(
              (current, parent) => eq(current.sup_orgId, parent.orgId),
              (current, parent) => ({
              orgId: current.orgId,
              sup_orgId: parent.sup_orgId,
              distance: add(current.distance, 1),
              })
            )
          )
        ))
      ),
      { dialect: "postgresql", format: "compact" }
    );

    expect(sql.match(/\bWITH\b/g) ?? []).toHaveLength(1);
    expect(sql).not.toContain("recursive_base_");
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
      pipe(
        orgInfo,
        loop((self) => pipe(
          self,
          join(
            orgInfo,
            inner(
              (u, o) => eq(u.sup_stru, o.stru_id),
              (u, o) => ({
              stru_id: u.stru_id,
              sup_stru: o.sup_stru,
              distance: add(o.distance, 1),
              })
            )
          )
        ))
      ),
      { dialect: "trino", format: "compact" }
    );

    expect(sql.match(/\bWITH\b/g) ?? []).toHaveLength(1);
    expect(sql).not.toContain("WITH recursive_step_");
    expect(sql).not.toContain("INNER JOIN (WITH ");
  });
});
