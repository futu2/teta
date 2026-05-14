import { describe, expect, test } from "bun:test";
import { explain, table, t, filter, map, eq, loop, take, isNotNull, toIR, pipe } from "../mod.ts";
import { irToSql } from "@teta/sql";
describe("explain api", () => {
    test("returns IR, AST, SQL, params, and stage metadata", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const query = pipe(
            users,
            filter((user) => eq(user.id, 42)),
            map((user) => ({ id: user.id })),
            take(1)
        );
        const result = explain(query, {
            dialect: "postgresql",
            format: "compact",
            parameterMode: "named",
        });
        expect(result.sql).toBe("SELECT users_0.id FROM users AS users_0 WHERE users_0.id = :p1 LIMIT 1");
        expect(result.params).toEqual([
            { value: 42, index: 1, name: "p1" },
        ]);
        expect(result.columnNames).toEqual(["id"]);
        expect(result.stages).toEqual([
            { index: 0, kind: "filter" },
            { index: 1, kind: "map" },
            { index: 2, kind: "take" },
        ]);
        expect(result.ctes).toEqual([]);
        expect(result.dialect.name).toBe("postgresql");
        expect(result.format).toBe("compact");
        expect(result.parameterMode).toBe("named");
        expect(result.parameterPrefix).toBe(":");
        expect(result.ast.type).toBe("select");
        expect(result.ir.stages).toHaveLength(3);
    });
    test("captures recursive CTE metadata", () => {
        const employees = table("employees", {
            id: t.int(),
            manager_id: t.nullable(t.int()),
        });
        const query = pipe(pipe(employees, map((employee) => ({
            id: employee.id,
            manager_id: employee.manager_id,
        }))), loop((self) => pipe(self, filter((row) => isNotNull(row.manager_id)))));
        const result = explain(query, {
            dialect: "postgresql",
            format: "compact",
        });
        expect(result.ctes).toHaveLength(1);
        expect(result.ctes[0]?.kind).toBe("recursive");
        expect(result.ctes[0]?.name).toContain("__teta_cte_loop_");
    });
    test("toIR returns backend-renderable query IR", () => {
        const users = table("users", {
            "user-id": t.int(),
        });
        const ir = toIR(users);
        expect(ir.columnNames).toEqual(["user-id"]);
        expect(ir.columnIdentifiers["user-id"]).toEqual({ name: "user-id", quoted: true });
        expect(ir.withs).toEqual([]);
        expect(irToSql(ir, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.\"user-id\" AS \"user-id\" FROM users AS users_0");
    });
});
