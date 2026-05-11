import { describe, expect, test } from "bun:test";
import type { With } from "node-sql-parser";

import { ensureSelectAst } from "../src/render/ast.ts";
import { buildNamedCte } from "../src/render/cte.ts";
import { optimizeCtes } from "../src/render/cte_optimize.ts";
import { buildSqlSelectAst } from "../src/render/source.ts";
import type { SelectAst } from "../src/render/types.ts";

function selectFrom(table: string): SelectAst {
  return buildSqlSelectAst({
    from: [{ db: null, table, rawTable: table, as: null }],
    columns: [{ expr: { type: "number", value: 1 }, as: "value" }],
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

describe("cte optimizer", () => {
  test("drops unreachable CTEs and keeps live recursive dependencies", () => {
    const dead = buildNamedCte("dead_cte", selectFrom("orders"));
    const live = buildNamedCte("live_cte", selectFrom("orders"));
    const loop = {
      ...buildNamedCte("loop_cte", selectFrom("live_cte")),
      recursive: true,
    } as With & { recursive: boolean };

    const root = selectFrom("loop_cte");
    const optimized = optimizeCtes(root, [dead, live, loop]);

    expect(optimized.map((cte) => cte.name.value)).toEqual(["live_cte", "loop_cte"]);
  });

  test("optimizes nested WITH lists inside CTE bodies before returning them", () => {
    const nestedLive = buildNamedCte("nested_live", selectFrom("orders"));
    const nestedDead = buildNamedCte("nested_dead", selectFrom("orders"));
    const outerAst = selectFrom("nested_live");
    outerAst.with = [nestedLive, nestedDead];

    const outer = buildNamedCte("outer_cte", outerAst);
    const root = selectFrom("outer_cte");
    const optimized = optimizeCtes(root, [outer]);
    const optimizedOuterAst = ensureSelectAst(optimized[0]!.stmt.ast, "outer cte");

    expect(optimizedOuterAst.with?.map((cte: any) => cte.name.value)).toEqual(["nested_live"]);
  });

  test("dedupes equivalent dependency chains and removes duplicate-only leaves", () => {
    const leftLeaf = buildNamedCte("left_leaf", selectFrom("orders"));
    const rightLeaf = buildNamedCte("right_leaf", selectFrom("orders"));
    const leftOuter = buildNamedCte("left_outer", selectFrom("left_leaf"));
    const rightOuter = buildNamedCte("right_outer", selectFrom("right_leaf"));

    const root = selectFrom("right_outer");
    const optimized = optimizeCtes(root, [leftLeaf, rightLeaf, leftOuter, rightOuter]);

    expect(optimized.map((cte) => cte.name.value)).toEqual(["right_leaf", "right_outer"]);
    expect((root.from as any)[0].table).toBe("right_outer");
    expect((ensureSelectAst(optimized[1]!.stmt.ast, "right_outer").from as any)[0].table).toBe(
      "right_leaf"
    );
  });
});
