import { describe, expect, test } from "bun:test";

import { sqlRenderer, table, t } from "../mod.ts";

describe("render strategy", () => {
  test("optimized strategy keeps simple pipelines fused", () => {
    const users = table("users", {
      id: t.int(),
      active: t.boolean(),
    });

    const sql = users
      .filter((user) => user.active.eq(true))
      .select((user) => ({ id: user.id }))
      .limit(1)
      .toSql(sqlRenderer({
        dialect: "postgresql",
        format: "compact",
        renderStrategy: "optimized",
      }));

    expect(sql).not.toContain("WITH ");
    expect(sql).toBe(
      "SELECT users_0.id FROM users AS users_0 WHERE users_0.active = TRUE LIMIT 1"
    );
  });

  test("readable strategy preserves stage boundaries with CTEs", () => {
    const users = table("users", {
      id: t.int(),
      active: t.boolean(),
    });

    const sql = users
      .filter((user) => user.active.eq(true))
      .select((user) => ({ id: user.id }))
      .limit(1)
      .toSql(sqlRenderer({
        dialect: "postgresql",
        format: "compact",
        renderStrategy: "readable",
      }));

    expect(sql).toContain("WITH cte_0 AS");
    expect(sql).toContain("cte_1 AS");
    expect(sql).toContain("LIMIT 1");
  });
});
