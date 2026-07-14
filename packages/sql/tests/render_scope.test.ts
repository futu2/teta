import { describe, expect, test } from "bun:test";

import { OUTER_TABLE_ALIAS, type ExprNode, type ScopeId } from "../src/ir/types.ts";
import { bindExprScopes, createAstRenderContext } from "../src/render/render.ts";
import { projectionItemsToScopeMap } from "../src/render/fused.ts";

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

  test("uses prototype-safe renderer binding and fused expression maps", () => {
    const names = ["__proto__", "constructor", "toString"];
    const context = createAstRenderContext();
    const expressions = projectionItemsToScopeMap(names.map((name) => ({
      expr: column(null, name),
      as: null,
    })));

    expect(Object.getPrototypeOf(context.identifierBindings)).toBeNull();
    expect(Object.getPrototypeOf(context.columnIdentifierBindings)).toBeNull();
    expect(Object.getPrototypeOf(context.cteNameBindings)).toBeNull();
    expect(Object.getPrototypeOf(expressions)).toBeNull();
    expect(Object.keys(expressions)).toEqual(names);
    for (const name of names) {
      expect(Object.hasOwn(expressions, name)).toBe(true);
      expect(expressions[name]).toEqual(column(null, name));
    }
  });
});
