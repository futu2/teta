import { describe, expect, test } from "bun:test";

import { explain, table, t } from "../mod.ts";

describe("explain api", () => {
  test("returns IR, AST, SQL, params, and stage metadata", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    const query = users
      .filter((user) => user.id.eq(42))
      .select((user) => ({ id: user.id }))
      .limit(1);

    const result = explain(query, {
      dialect: "postgresql",
      format: "compact",
      parameterMode: "named",
    });

    expect(result.sql).toBe(
      "SELECT users_0.id FROM users AS users_0 WHERE users_0.id = :p1 LIMIT 1"
    );
    expect(result.params).toEqual([
      { value: 42, index: 1, name: "p1" },
    ]);
    expect(result.columnNames).toEqual(["id"]);
    expect(result.stages).toEqual([
      { index: 0, kind: "filter" },
      { index: 1, kind: "select" },
      { index: 2, kind: "limit" },
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

    const query = employees
      .select((employee) => ({
        id: employee.id,
        manager_id: employee.manager_id,
      }))
      .loop((self) => self.filter((row) => row.manager_id.isNotNull()));

    const result = query.explain({
      dialect: "postgresql",
      format: "compact",
    });

    expect(result.ctes).toHaveLength(1);
    expect(result.ctes[0]?.kind).toBe("recursive");
    expect(result.ctes[0]?.name).toContain("__teta_cte_loop_");
  });
});
