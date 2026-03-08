import { describe, expect, test } from "bun:test";

import { sqlRenderer } from "../mod.ts";
import {
  ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT,
  USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT,
} from "./helpers/expected-sql.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";

describe("joins and aggregates", () => {
  test("renders a left join followed by aggregate grouping", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();

    const query = users
      .leftJoin(orders, (user, order) => user.id.eq(order.user_id))
      .aggregate((row) => ({
        user_id: row.id.group(),
        order_count: row.order_id.count(),
        total_spend: row.total.sum(),
      }));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" })).sql
    ).toBe(USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT);
  });

  test("renders grouped aggregates after filtering", () => {
    const orders = createOrdersTable();

    const query = orders
      .filter((order) => order.total.gt(0))
      .aggregate((order) => ({
        user_id: order.user_id.group(),
        order_count: order.order_id.count(),
        total_spend: order.total.sum(),
      }));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" })).sql
    ).toBe(ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT);
  });
});
