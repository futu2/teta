import { describe, expect, test } from "bun:test";
import { map, pick, pipe, t, table, toIR, toSql } from "../mod.ts";

describe("pick(record)", () => {
  test("keeps selected fields in the requested order inside map", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
      active: t.boolean(),
    });
    const query = pipe(users, map(pick("name", "id")));

    expect(Object.keys(query.columns)).toEqual(["name", "id"]);
    expect(toIR(query).columnNames).toEqual(["name", "id"]);
    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.name, users_0.id FROM users AS users_0"
    );
  });

  test("accepts a key array", () => {
    const users = table("users", { id: t.int(), name: t.string() });
    const query = pipe(users, map(pick(["name", "id"])));

    expect(toIR(query).columnNames).toEqual(["name", "id"]);
  });

  test("rejects unknown fields", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    expect(() => pipe(users, map((pick as any)("missing")))).toThrow(
      "pick() key 'missing' does not exist on the record"
    );
  });
});
