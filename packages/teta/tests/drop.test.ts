import { describe, expect, test } from "bun:test";
import { drop, pipe, t, table, toIR, toSql } from "../mod.ts";

describe("drop", () => {
  test("removes selected columns and preserves remaining order", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
      active: t.boolean(),
    });
    const query = pipe(users, drop("name"));

    expect(Object.keys(query.columns)).toEqual(["id", "active"]);
    expect(toIR(query).columnNames).toEqual(["id", "active"]);
    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id, users_0.active FROM users AS users_0"
    );
  });

  test("rejects unknown columns and an empty result shape", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    expect(() => pipe(users, (drop as any)("missing"))).toThrow(
      "Unknown current row column 'missing'. Available columns: id, name"
    );
    expect(() => pipe(users, drop("id", "name"))).toThrow(
      "map() and fold() now expect an object shape"
    );
  });
});
