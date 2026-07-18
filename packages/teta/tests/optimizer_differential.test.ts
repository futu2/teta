import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import {
  asc,
  count,
  desc,
  eq,
  filter,
  fold,
  gt,
  inner,
  join,
  map,
  pipe,
  sort,
  sum,
  t,
  table,
  take,
  toSql,
  group,
} from "../mod.ts";

let database: Database | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

function runBoth(query: Parameters<typeof toSql>[0]): [unknown[], unknown[]] {
  if (!database) database = new Database(":memory:");
  const optimized = toSql(query, {
    dialect: "sqlite",
    format: "compact",
    renderStrategy: "optimized",
  });
  const readable = toSql(query, {
    dialect: "sqlite",
    format: "compact",
    renderStrategy: "readable",
  });
  return [database.query(optimized).all(), database.query(readable).all()];
}

describe("optimizer semantic equivalence", () => {
  test("preserves post-projection filters, ordering, and limits", () => {
    database = new Database(":memory:");
    database.run(`CREATE TABLE users (id INTEGER, name TEXT, active INTEGER, score INTEGER)`);
    database.run(`INSERT INTO users VALUES
      (1, 'Ada', 1, 40),
      (2, 'Grace', 1, 25),
      (3, 'Linus', 0, 100),
      (4, 'Ken', 1, 10)`);

    const users = table("users", {
      id: t.int(),
      name: t.string(),
      active: t.boolean(),
      score: t.int(),
    });
    const query = pipe(
      users,
      filter((user) => eq(user.active, true)),
      map((user) => ({ id: user.id, label: user.name, points: user.score })),
      filter((user) => gt(user.points, 10)),
      sort((user) => [desc(user.points), asc(user.id)]),
      take(2)
    );

    const [optimized, readable] = runBoth(query);
    expect(optimized).toEqual(readable);
    expect(optimized).toEqual([
      { id: 1, label: "Ada", points: 40 },
      { id: 2, label: "Grace", points: 25 },
    ]);
  });

  test("preserves grouped aggregates and HAVING predicates", () => {
    database = new Database(":memory:");
    database.run(`CREATE TABLE orders (id INTEGER, user_id INTEGER, total INTEGER)`);
    database.run(`INSERT INTO orders VALUES
      (1, 10, 5),
      (2, 10, 15),
      (3, 20, 7),
      (4, 20, 8),
      (5, 30, 50)`);

    const orders = table("orders", {
      id: t.int(),
      user_id: t.int(),
      total: t.int(),
    });
    const query = pipe(
      orders,
      filter((order) => gt(order.total, 0)),
      fold((order) => ({
        user_id: group(order.user_id),
        order_count: count(order.id),
        total: sum(order.total),
      })),
      filter((row) => gt(row.total, 15)),
      sort((row) => asc(row.user_id))
    );

    const [optimized, readable] = runBoth(query);
    expect(optimized).toEqual(readable);
    expect(optimized).toEqual([
      { user_id: 10, order_count: 2, total: 20 },
      { user_id: 30, order_count: 1, total: 50 },
    ]);
  });

  test("preserves joined subquery results", () => {
    database = new Database(":memory:");
    database.run(`CREATE TABLE users (id INTEGER, name TEXT)`);
    database.run(`CREATE TABLE orders (id INTEGER, user_id INTEGER, total INTEGER)`);
    database.run(`INSERT INTO users VALUES (1, 'Ada'), (2, 'Grace')`);
    database.run(`INSERT INTO orders VALUES (10, 1, 20), (11, 1, 5), (12, 2, 30)`);

    const users = table("users", { id: t.int(), name: t.string() });
    const orders = table("orders", { id: t.int(), user_id: t.int(), total: t.int() });
    const expensiveOrders = pipe(
      orders,
      filter((order) => gt(order.total, 10)),
      map((order) => ({ user_id: order.user_id, total: order.total }))
    );
    const query = pipe(
      users,
      join(expensiveOrders, inner(
        (user, order) => eq(user.id, order.user_id),
        (user, order) => ({ name: user.name, total: order.total })
      )),
      sort((row) => asc(row.name))
    );

    const [optimized, readable] = runBoth(query);
    expect(optimized).toEqual(readable);
    expect(optimized).toEqual([
      { name: "Ada", total: 20 },
      { name: "Grace", total: 30 },
    ]);
  });
});
