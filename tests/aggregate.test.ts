import { describe, expect, test } from "bun:test";

import { ident, namespace, omit, pick, prefix, preset, project, projects, remap, rename, selectAll, spread, sqlRenderer } from "../mod.ts";
import {
  ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT,
  ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT,
  ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT,
  USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT,
  QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT,
  ORDERS_SPREAD_RENAME_AGG_POSTGRES_COMPACT,
  ORDERS_OMIT_RENAME_AGG_POSTGRES_COMPACT,
  ORDERS_NAMESPACE_AGG_POSTGRES_COMPACT,
  ORDERS_NAMESPACE_SEPARATOR_AGG_POSTGRES_COMPACT,
  ORDERS_REMAP_AGG_POSTGRES_COMPACT,
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

  test("supports projection-list aggregate syntax with ident()", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => [
        project(ident("User Id"), order.user_id.group()),
        project(ident("Total Spend"), order.total.sum()),
      ])
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT);
  });

  test("supports projection-list aggregate syntax for quoted outputs", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) => [
        project("User Id", order.user_id.group(), { quoted: true }),
        project("Total Spend", order.total.sum(), { quoted: true }),
      ])
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT);
  });

  test("supports hoisted projects() aggregate syntax", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          project("User Id", order.user_id.group(), { quoted: true }),
          project("Total Spend", order.total.sum(), { quoted: true })
        )
      )
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT);
  });

  test("supports spread() + rename() aggregate composition", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          spread({ user_id: order.user_id.group() }),
          rename(order.total.sum(), ident("Total Spend"))
        )
      )
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_SPREAD_RENAME_AGG_POSTGRES_COMPACT);
  });
  test("supports omit() + rename() aggregate composition", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          omit({
            user_id: order.user_id.group(),
            order_count: order.order_id.count(),
          }, "order_count"),
          rename(order.total.sum(), ident("Total Spend"))
        )
      )
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_OMIT_RENAME_AGG_POSTGRES_COMPACT);
  });

  test("supports namespace() aggregate composition", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          namespace(
            "order",
            preset(
              selectAll({ user_id: order.user_id.group() }),
              rename(order.total.sum(), "total")
            )
          )
        )
      )
      .filter((row) => row.order_total.gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_NAMESPACE_AGG_POSTGRES_COMPACT);
  });

  test("supports namespace() with a custom separator on postgresql", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          namespace(
            "order",
            { separator: "__" },
            preset(
              selectAll({ user_id: order.user_id.group() }),
              rename(order.total.sum(), "total")
            )
          )
        )
      )
      .filter((row) => row["order__total"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_NAMESPACE_SEPARATOR_AGG_POSTGRES_COMPACT);
  });

  test("supports remap() aggregate composition", () => {
    const orders = createOrdersTable();

    const query = orders
      .aggregate((order) =>
        projects(
          remap(
            { user_id: ident("User Id"), total: ident("Total Spend") },
            preset(
              rename(order.user_id.group(), "user_id"),
              rename(order.total.sum(), "total")
            )
          )
        )
      )
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_REMAP_AGG_POSTGRES_COMPACT);
  });

  test("supports nested preset() aggregate composition", () => {
    const orders = createOrdersTable();
    const groupedPreset = (order: ReturnType<typeof createOrdersTable>["columns"]) =>
      preset(selectAll({ user_id: order.user_id.group() }));

    const query = orders
      .aggregate((order) =>
        projects(groupedPreset(order), preset(rename(order.total.sum(), ident("Total Spend"))))
      )
      .filter((row) => row["Total Spend"].gt(100));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_SPREAD_RENAME_AGG_POSTGRES_COMPACT);
  });


});
