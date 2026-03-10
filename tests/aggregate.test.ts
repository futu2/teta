import { describe, expect, test } from "bun:test";

import * as R from "remeda";
import { sqlRenderer } from "../mod.ts";
import {
  ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT,
  ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT,
  USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT,
  QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT,
} from "./helpers/expected-sql.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";

describe("joins and aggregates", () => {
  test("renders a left join followed by aggregate grouping", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();

    const query = users
      .join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" })
      .aggregate((row) => ({
        user_id: row.id.group(),
        order_count: row.order_id.count(),
        total_spend: row.total.sum(),
      }));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT);
  });

  test("splits aggregate filters across WHERE and HAVING", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => ({
        user_id: order.user_id.group(),
        total_spend: order.total.sum(),
      }))
      .filter((row) => row.user_id.gt(10).and(row.total_spend.gt(100)));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT);
  });

  test("factors shared predicates across grouped aggregate disjunctions", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => ({
        user_id: order.user_id.group(),
        total_spend: order.total.sum(),
      }))
      .filter((row) =>
        row.user_id.gt(10).and(row.total_spend.gt(100)).group().or(
          row.user_id.gt(10).and(row.total_spend.gt(200)).group()
        )
      );

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT);
  });

  test("canonicalizes commutative shared disjunctions before aggregate pushdown", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => ({
        user_id: order.user_id.group(),
        total_spend: order.total.sum(),
      }))
      .filter((row) =>
        row.user_id.gt(10).or(row.user_id.lt(0)).group().and(row.total_spend.gt(100)).group().or(
          row.user_id.lt(0).or(row.user_id.gt(10)).group().and(row.total_spend.gt(200)).group()
        )
      );

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT);
  });

  test("renders aggregate filters as HAVING", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => ({
        user_id: order.user_id.group(),
        total_spend: order.total.sum(),
      }))
      .filter((row) => row.total_spend.gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT);
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
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT);
  });

  test("auto-quotes invalid aggregate output keys", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => ({
        ["User Id"]: order.user_id.group(),
        ["Total Spend"]: order.total.sum(),
      }))
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT);
  });

  test("supports remeda omit() inside aggregate shaping", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        R.omit({
          user_id: order.user_id.group(),
          order_count: order.order_id.count(),
          total_spend: order.total.sum(),
        }, ["order_count"])
      )
      .filter((row) => row.total_spend.gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT);
  });
});
