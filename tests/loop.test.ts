import { describe, expect, test } from "bun:test";
import { sqlRenderer, filter, join, eq, isNull, map, loop, toSql } from "../mod.ts";
import { buildOrgTreeQuery, createEmployeesTable } from "./helpers/fixtures.ts";
describe("recursive loop queries", () => {
    test("renders stable recursive CTE names across separate query instances", () => {
        const renderer = sqlRenderer({ dialect: "postgresql", format: "compact" });
        const sqlA = toSql(map(buildOrgTreeQuery(), (employee) => ({ id: employee.id, name: employee.name })), renderer);
        const sqlB = toSql(map(buildOrgTreeQuery(), (employee) => ({ id: employee.id, name: employee.name })), renderer);
        expect(sqlA).toBe(sqlB);
    });
    test("renders a recursive employee tree CTE", () => {
        const sql = toSql(map(buildOrgTreeQuery(), (employee) => ({ id: employee.id, name: employee.name })), sqlRenderer({ dialect: "postgresql", format: "compact" }));
        const match = sql.match(/^WITH RECURSIVE (loop_\d+)\(id, name, manager_id\) AS \(/);
        expect(match).not.toBeNull();
        const loopName = match?.[1];
        expect(loopName).toBeDefined();
        expect(sql).toContain("SELECT employees_0.id, employees_0.name, employees_0.manager_id FROM employees AS employees_0 WHERE employees_0.manager_id IS NULL");
        expect(sql).toContain(`INNER JOIN ${loopName} AS loop_1 ON employees_0.manager_id = loop_1.id`);
        expect(sql).toContain(`SELECT ${loopName}_0.id, ${loopName}_0.name FROM ${loopName} AS ${loopName}_0`);
    });
    test("supports `base.loop(step)` as the recursive builder method", () => {
        const employees = createEmployeesTable();
        const base = map(filter(employees, (employee) => isNull(employee.manager_id)), (employee) => ({
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
        }));
        const sql = toSql(map(loop(base, (self) => join(employees, self, (employee, current) => eq(employee.manager_id, current.id), { merge: (employee) => ({
                id: employee.id,
                name: employee.name,
                manager_id: employee.manager_id,
            }) })), (employee) => ({ id: employee.id, name: employee.name })), sqlRenderer({ dialect: "postgresql", format: "compact" }));
        expect(sql).toContain("WITH RECURSIVE");
        expect(sql).toContain("INNER JOIN");
    });
});
