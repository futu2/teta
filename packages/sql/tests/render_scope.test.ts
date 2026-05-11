import { describe, expect, test } from "bun:test";

import { OUTER_TABLE_ALIAS, type ExprNode, type ScopeId } from "../src/ir/types.ts";
import { bindExprScopes } from "../src/render/render.ts";

const column = (table: string | null, name: string): ExprNode<unknown> => ({
  kind: "column",
  table,
  name,
});

const scope1 = "__teta_scope_1" as ScopeId;
const scope2 = "__teta_scope_2" as ScopeId;

describe("render scope binding", () => {
  test("binds internal scope names recursively", () => {
    const expr: ExprNode<boolean> = {
      kind: "binary",
      op: "=",
      left: column(scope1, "id"),
      right: {
        kind: "func",
        name: "coalesce",
        args: [column(scope2, "name"), column(null, "fallback")],
      },
    };

    expect(
      bindExprScopes(expr, {
        [scope1]: "users_0",
        [scope2]: "orders_0",
      })
    ).toEqual({
      kind: "binary",
      op: "=",
      left: column("users_0", "id"),
      right: {
        kind: "func",
        name: "coalesce",
        args: [column("orders_0", "name"), column(null, "fallback")],
      },
    });
  });

  test("preserves outer alias references", () => {
    const expr = column(OUTER_TABLE_ALIAS, "id");

    expect(bindExprScopes(expr, { [scope1]: "users_0" })).toEqual(expr);
  });
});
