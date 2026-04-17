import { expect, test } from "bun:test";
import { toSql } from "../mod.ts";

test("render benchmark query compiles with explicit join overlap handling", async () => {
  const { renderBenchmarkQuery } = await import("../../../benchmarks/render_shared.ts");

  const sql = toSql(renderBenchmarkQuery, {
    dialect: "postgresql",
    format: "compact",
    renderStrategy: "optimized",
  });

  expect(sql.startsWith("SELECT ")).toBe(true);
});
