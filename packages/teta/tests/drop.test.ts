import { describe, expect, test } from "bun:test";
import { drop, map, pipe, t, table, toIR, toSql } from "../mod.ts";

describe("drop(record)", () => {
  test("removes selected fields inside a map projection and preserves order", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
      active: t.boolean(),
    });
    const query = pipe(users, map(drop("name")));

    expect(Object.keys(query.columns)).toEqual(["id", "active"]);
    expect(toIR(query).columnNames).toEqual(["id", "active"]);
    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id, users_0.active FROM users AS users_0"
    );
  });

  test("ignores fields that are not present", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    const query = pipe(users, map((drop as any)("missing")));
    expect(toIR(query).columnNames).toEqual(["id", "name"]);
  });

  test("rejects an empty mapped shape", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    expect(() => pipe(users, map(drop("id", "name")))).toThrow(
      "map() and fold() now expect an object shape"
    );
  });
});
