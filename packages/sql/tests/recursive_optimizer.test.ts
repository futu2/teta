import { describe, expect, test } from "bun:test";

import type { ExprNode, ScopeId, ProjectionItem, Stage } from "../src/ir/types.ts";
import { optimizeLoopStages } from "../src/render/recursive_optimizer.ts";

const column = (name: string, table: string | null = null): ExprNode<unknown> => ({
  kind: "column",
  table,
  name,
});

const literal = (value: string | number | boolean | null): ExprNode<unknown> => ({
  kind: "literal",
  value,
});

const equals = (
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprNode<boolean> => ({
  kind: "binary",
  op: "=",
  left,
  right,
});

const select = (name: string): ProjectionItem => ({
  expr: column(name),
  as: null,
});

describe("recursive optimizer", () => {
  test("merges adjacent loop filters after pruning unused outputs", () => {
    const left = equals(column("active"), literal(true));
    const right = equals(column("age"), literal(18));
    const stages: Stage[] = [
      {
        kind: "filter",
        predicate: left,
        projectAll: [select("id"), select("name")],
      },
      {
        kind: "filter",
        predicate: right,
        projectAll: [select("id")],
      },
    ];

    const optimized = optimizeLoopStages(stages, ["id"], "base");

    expect(optimized).toHaveLength(1);
    expect(optimized[0]).toEqual({
      kind: "filter",
      predicate: {
        kind: "binary",
        op: "AND",
        left,
        right,
      },
      projectAll: [select("id")],
    });
  });

  test("removes no-op loop maps", () => {
    const filter: Stage = {
      kind: "filter",
      predicate: equals(column("active"), literal(true)),
      projectAll: [select("id")],
    };
    const selectStage: Stage = {
      kind: "map",
      items: [select("id")],
      keys: ["id"],
      groupBy: null,
      outputScopeId: "loop_scope_1" as ScopeId,
    };

    const optimized = optimizeLoopStages([filter, selectStage], ["id"], "step");

    expect(optimized).toEqual([filter]);
  });
});
