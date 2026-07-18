import { describe, expect, test } from "bun:test";

import {
  eq,
  filter,
  isPreparedQuery,
  map,
  param,
  pipe,
  prepare,
  t,
  table,
  toSqlResult,
} from "../mod.ts";

describe("typed prepared queries", () => {
  const users = table("users", {
    id: t.int(),
    tenant_id: t.uuid(),
    active: t.boolean(),
  });

  test("derives expressions and exact bindings from a parameter schema", () => {
    const query = prepare(
      { tenantId: t.uuid(), minimumId: t.int() },
      (params) => pipe(
        users,
        filter((user) => eq(user.tenant_id, params.tenantId)),
        filter((user) => eq(user.id, params.minimumId)),
        map((user) => ({ id: user.id }))
      )
    );

    expect(isPreparedQuery(query)).toBe(true);
    expect(Object.isFrozen(query)).toBe(true);
    expect(Object.isFrozen(query.parameters)).toBe(true);
    expect(toSqlResult(query, {
      dialect: "postgresql",
      format: "compact",
      params: { tenantId: "tenant-a", minimumId: 3 },
    })).toEqual({
      sql: "SELECT users_0.id FROM users AS users_0 WHERE users_0.tenant_id = :tenantId AND users_0.id = :minimumId",
      params: [
        { value: "tenant-a", index: 1, name: "tenantId" },
        { value: 3, index: 2, name: "minimumId" },
      ],
    });
  });

  test("validates descriptor inputs and exact runtime keys", () => {
    const query = prepare({ id: t.int() }, (params) =>
      pipe(users, filter((user) => eq(user.id, params.id))));

    expect(() => toSqlResult(query, { params: { id: 1, extra: true } } as never))
      .toThrow("Prepared query params must be exactly: id");
    expect(() => toSqlResult(query, { params: { id: "one" } } as never))
      .toThrow("Expected int value");
  });

  test("rejects declared/used parameter drift", () => {
    expect(() => prepare({ id: t.int() }, () => users)).toThrow("unused: id");
    expect(() => prepare({}, () =>
      pipe(users, filter((user) => eq(user.id, param("id", t.int()))))))
      .toThrow("undeclared: id");
  });

  test("composes nullable and array descriptor codecs", () => {
    const descriptor = t.nullable(t.array(t.int()));

    expect(descriptor.encode([1, 2, 3])).toEqual([1, 2, 3]);
    expect(descriptor.decode([1, 2, 3])).toEqual([1, 2, 3]);
    expect(descriptor.encode(null)).toBeNull();
    expect(() => descriptor.encode([1, 2.5])).toThrow("Expected int value");
  });
});
