import { describe, expect, test } from "bun:test";

import { TetaUserError, sqlRenderer } from "../mod.ts";
import {
  GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR,
  GROUP_OUTSIDE_AGGREGATE_ERROR,
  LEGACY_SELECTION_ARRAY_ERROR,
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
      users.join(orders, (user, order) => user.id.eq(order.user_id), { type: "cross" as never })
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

    expect(() => base.loop(invalidStep)).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
  });

  test("rejects legacy array selection syntax at runtime", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => ([user.id] as never))
    ).toThrow(LEGACY_SELECTION_ARRAY_ERROR);
  });

  test("rejects non-canonical built-in dialect names", () => {
    const users = createUsersTable();

    expect(() =>
      users
        .select((user) => ({ id: user.id }))
        .toSql(sqlRenderer({ dialect: "PostgreSQL" }))
    ).toThrow(NON_CANONICAL_POSTGRES_DIALECT_ERROR);
  });

  test("user-facing errors expose stable error codes", () => {
    const users = createUsersTable();

    try {
      users.select((user) => ({
        bad: user.id.group(),
      }));
      throw new Error("Expected select() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("GROUP_OUTSIDE_AGGREGATE");
      expect((error as TetaUserError).kind).toBe("user");
    }
  });
});
