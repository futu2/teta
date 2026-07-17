import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import {
  asc,
  distinct,
  map,
  pipe,
  sort,
  t,
  table,
  take,
  toIR,
  toSql,
  values,
} from "../mod.ts";
import type { SqlInt, SqlString } from "../mod.ts";

let database: Database | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe("distinct", () => {
  test("is an immutable schema-preserving query step", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const step = distinct<{ id: SqlInt; name: SqlString }>();
    const query = pipe(users, step);
    const ir = toIR(query);

    expect(step.kind).toBe("query_step");
    expect(step.stepName).toBe("distinct");
    expect(Object.isFrozen(step)).toBe(true);
    expect(query.columns).toEqual(users.columns);
    expect(ir.stages.map((stage) => stage.kind)).toEqual(["distinct"]);
    expect(Object.isFrozen(ir.stages[0])).toBe(true);
  });

  test("fuses projection, deduplication, ordering, and limit", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const query = pipe(
      users,
      map((user) => ({ name: user.name })),
      distinct(),
      sort((row) => asc(row.name)),
      take(5)
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT DISTINCT users_0.name FROM users AS users_0 ORDER BY name ASC LIMIT 5"
    );
  });

  test("keeps a boundary when deduplication precedes a projection", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const query = pipe(
      users,
      distinct(),
      map((user) => ({ name: user.name }))
    );

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "WITH cte_0(id, name) AS (SELECT DISTINCT users_0.id AS id, users_0.name AS name FROM users AS users_0) SELECT cte_0_0.name FROM cte_0 AS cte_0_0"
    );
  });

  test("normalizes adjacent distinct stages by idempotence", () => {
    const users = table("users", { id: t.int() });
    const query = pipe(users, distinct(), distinct());

    expect(toIR(query).stages.map((stage) => stage.kind)).toEqual(["distinct"]);
  });

  test("removes duplicate rows in SQLite", () => {
    const query = pipe(
      values([
        { name: "Ada" },
        { name: "Ada" },
        { name: "Grace" },
      ]),
      distinct(),
      sort((row) => asc(row.name))
    );

    database = new Database(":memory:");
    const rows = database.query(toSql(query, {
      dialect: "sqlite",
      format: "compact",
    })).all();

    expect(rows).toEqual([{ name: "Ada" }, { name: "Grace" }]);
  });
});
