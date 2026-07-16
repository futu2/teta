import { describe, expect, test } from "bun:test";
import { pick, pipe, t, table, toIR, toSql } from "../mod.ts";

describe("pick", () => {
  test("keeps selected columns in the requested order", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
      active: t.boolean(),
    });
    const query = pipe(users, pick("name", "id"));

    expect(Object.keys(query.columns)).toEqual(["name", "id"]);
    expect(toIR(query).columnNames).toEqual(["name", "id"]);
    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.name, users_0.id FROM users AS users_0"
    );
  });

  test("rejects unknown columns", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    expect(() => pipe(users, (pick as any)("missing"))).toThrow(
      "Unknown current row column 'missing'. Available columns: id, name"
    );
  });
});
