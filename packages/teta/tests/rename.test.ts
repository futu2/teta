import { describe, expect, test } from "bun:test";
import { pipe, rename, t, table, toIR, toSql } from "../mod.ts";

describe("rename", () => {
  test("renames every column while preserving order and expressions", () => {
    const users = table("users", { id: t.int(), name: t.string() });
    const step = rename((key) => `user_${key}`);
    const query = pipe(users, step);

    expect(Object.keys(query.columns)).toEqual(["user_id", "user_name"]);
    expect(toIR(query).columnNames).toEqual(["user_id", "user_name"]);
    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toContain(
      "users_0.id AS user_id"
    );
  });

  test("rejects empty and duplicate mapped names", () => {
    const users = table("users", { id: t.int(), name: t.string() });

    expect(() => pipe(users, rename(() => ""))).toThrow(
      "rename() must return a non-empty column name"
    );
    expect(() => pipe(users, rename(() => "value"))).toThrow(
      "rename() produced duplicate column name 'value'"
    );
    expect(() => pipe(users, rename((key) => `__teta_${key}`))).toThrow(
      "Projection key is reserved for Teta internals: __teta_id"
    );
  });
});
