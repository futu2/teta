import { describe, expect, test } from "bun:test";

import { loop, omit, pick, project, projects, remap, rename, selectAll, spread, sqlRenderer } from "../mod.ts";
import {
  GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR,
  GROUP_OUTSIDE_AGGREGATE_ERROR,
  LOOP_COLUMN_MISMATCH_ERROR,
  NON_CANONICAL_POSTGRES_DIALECT_ERROR,
  UNSUPPORTED_CROSS_JOIN_ERROR,
  duplicateProjectionNameError,
  unknownProjectionKeyError,
  unknownProjectionRemapKeyError,
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

    expect(() => loop(base, invalidStep)).toThrow(LOOP_COLUMN_MISMATCH_ERROR);
  });

  test("rejects duplicate projection names at runtime when type checks are bypassed", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => ([
        project("dup", user.id),
        project("dup", user.name),
      ] as never))
    ).toThrow(duplicateProjectionNameError("dup"));
  });

  test("rejects duplicate projection names from spread() composition at runtime", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => ([
        ...(projects(spread(user)) as any),
        rename(user.name, "id"),
      ] as never))
    ).toThrow(duplicateProjectionNameError("id"));
  });

  test("rejects unknown pick() keys at runtime when type checks are bypassed", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => projects(pick(user as any, "missing")))
    ).toThrow(unknownProjectionKeyError("missing"));
  });

  test("rejects unknown remap() keys at runtime when type checks are bypassed", () => {
    const users = createUsersTable();

    expect(() =>
      users.select((user) => projects(remap({ missing: "x" } as any, selectAll(user))))
    ).toThrow(unknownProjectionRemapKeyError("missing"));
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
