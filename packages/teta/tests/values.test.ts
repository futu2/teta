import { describe, expect, test } from "bun:test";

import {
  eq,
  filter,
  gt,
  inner,
  join,
  map,
  t,
  table,
  toIR,
  toSql,
  values,
  pipe,
} from "../mod.ts";

describe("values(query root)", () => {
  test("renders inline rows on postgresql", () => {
    const query = values([
      { id: 1, name: "Ada" },
      { id: 2, name: "Grace" },
      { id: 3, name: "Linus" },
    ]);

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT values_0.id, values_0.name FROM (SELECT 1 AS id, 'Ada' AS name UNION ALL SELECT 2 AS id, 'Grace' AS name UNION ALL SELECT 3 AS id, 'Linus' AS name) AS values_0"
    );
  });

  test("supports filtering inline rows", () => {
    const query = pipe(
      values([
        { id: 1, name: "Ada" },
        { id: 2, name: "Grace" },
      ]),
      filter((row) => gt(row.id, 1))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT values_0.id AS id, values_0.name AS name FROM (SELECT 1 AS id, 'Ada' AS name UNION ALL SELECT 2 AS id, 'Grace' AS name) AS values_0 WHERE values_0.id > 1"
    );
  });

  test("supports joining against inline rows", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    const labels = values([
      { user_id: 1, label: "vip" },
      { user_id: 2, label: "staff" },
    ]);

    const query = pipe(
      users,
      join(
        labels,
        inner((user, labelRow) => eq(user.id, labelRow.user_id))
      ),
      map((row) => ({
        id: row.id,
        name: row.name,
        label: row.label,
      }))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "WITH join_0(user_id, label) AS (SELECT values_0.user_id, values_0.label FROM (SELECT 1 AS user_id, 'vip' AS label UNION ALL SELECT 2 AS user_id, 'staff' AS label) AS values_0) SELECT users_0.id, users_0.name, values_1.label FROM users AS users_0 INNER JOIN join_0 AS values_1 ON users_0.id = values_1.user_id"
    );
  });

  test("serializes bigint cells as JSON-compatible IR literals", () => {
    const seed = values([{ id: 9007199254740993n }]);
    const ir = toIR(seed);

    expect(ir.version).toBe(1);
    expect(ir.source).toEqual({
      kind: "values",
      rows: [{ id: { kind: "bigint_literal", value: "9007199254740993" } }],
    });
    expect(toSql(seed, { dialect: "postgresql" })).toContain("9007199254740993");
  });

  test("preserves prototype-sensitive column names", () => {
    const seed = values([{
      ["__proto__"]: "safe",
      constructor: "ctor",
      toString: "method",
    }]);
    const source = toIR(seed).source;

    expect("kind" in source && source.kind).toBe("values");
    if (!("kind" in source) || source.kind !== "values") throw new Error("Expected values source");
    expect(Object.keys(source.rows[0]!)).toEqual(["__proto__", "constructor", "toString"]);
    expect(toSql(seed, { dialect: "postgresql", format: "compact" })).toBe(
      `SELECT values_0.__proto__, values_0.constructor, values_0."toString" FROM (SELECT 'safe' AS __proto__, 'ctor' AS constructor, 'method' AS "toString") AS values_0`
    );
  });
});
