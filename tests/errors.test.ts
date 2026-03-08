import { describe, expect, test } from "bun:test";

import { loop, sqlRenderer } from "../mod.ts";
import {
  GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR,
  GROUP_OUTSIDE_AGGREGATE_ERROR,
  LOOP_COLUMN_MISMATCH_ERROR,
  NON_CANONICAL_POSTGRES_DIALECT_ERROR,
  UNSUPPORTED_CROSS_JOIN_ERROR,
} from "./helpers/expected-errors.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";

describe("error paths", () => {
  test("rejects group() outside aggregate", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => ({
        bad: user.id.group(),
      }))
    ).toThrow(GROUP_OUTSIDE_AGGREGATE_ERROR);
  });

  test("rejects group() inside aggregate functions", () => {
    const users = createUsersTable();

    expect(() =>
      users.aggregate((user) => ({
        bad: user.id.group().count(),
      }))
    ).toThrow(GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR);
  });

  test("rejects unsupported join types through the query API", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();

    expect(() =>
      users.join(orders, (user, order) => user.id.eq(order.user_id), "cross" as never)
    ).toThrow(UNSUPPORTED_CROSS_JOIN_ERROR);
  });

  test("rejects loop steps with mismatched column names", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const base = users.select((user) => ({ id: user.id }));

    const invalidStep = () =>
      orders.select((order) => ({
        user_id: order.user_id,
      })) as unknown as typeof base;

    expect(() => loop(base, invalidStep)).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
  });

  test("rejects non-canonical built-in dialect names", () => {
    const users = createUsersTable();

    expect(() =>
      users
        .select((user) => ({ id: user.id }))
        .toSql(sqlRenderer({ dialect: "PostgreSQL" }))
    ).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
  });
});
