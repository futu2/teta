import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";

import * as R from "remeda";
import { lit, sqlRenderer, table, t } from "../mod.ts";

import {
  USER_PIPELINE_POSTGRES_COMPACT,
  USER_PIPELINE_POSTGRES_PRETTY,
  USERS_NAME_LENGTH_SQLITE_COMPACT,
  EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT,
  USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT,
  USERS_SELECT_FILTER_POSTGRES_COMPACT,
  ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT,
  QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT,
  QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT,
  QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT,
  QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT,
  QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT,
  ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT,
  ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT,
  ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT,
  ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT,
  ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT,
  ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT,
  ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT,
  ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT,
  ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT,
  ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT,
} from "./helpers/expected-sql.ts";
import { buildUserPipelineQuery, createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";

describe("Query.toSql", () => {
  test("renders a joined select without an intermediate CTE", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const query = users
      .join(orders, (user, order) => user.id.eq(order.user_id), { type: "left" })
      .select((row) => ({
        user_id: row.id,
        total: row.total,
      }));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
  });

  test("pushes a post-select filter into WHERE", () => {
    const users = createUsersTable();
    const query = users
      .select((user) => ({
        normalized_name: user.name.replace(" ", "_"),
      }))
      .filter((row) => row.normalized_name.eq("Ada_Lovelace"));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USERS_SELECT_FILTER_POSTGRES_COMPACT);
  });

  test("renders a lateral join through join options", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });
    const orders = table("orders", {
      id: t.int(),
      user_id: t.int(),
      total: t.float(),
    });
    const query = users.join(
      (user) =>
        orders
          .filter((order) => order.user_id.eq(user.id))
          .select((order) => ({
            order_id: order.id,
            total: order.total,
          })),
      () => lit(true),
      { lateral: true }
    );

    const sql = query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }));
    expect(sql).toContain("JOIN LATERAL (");
    expect(sql).toContain("WHERE orders_0.user_id = users_0.id");
  });

  test("hoists a non-lateral subquery join into a CTE", () => {
    const users = createUsersTable();
    const orders = createOrdersTable();
    const query = users.join(
      orders
        .filter((order) => order.total.gt(0))
        .select((order) => ({
          user_id: order.user_id,
          total: order.total,
        })),
      (user, order) => user.id.eq(order.user_id)
    );

    const sql = query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }));
    expect(sql).toContain("WITH join_0 AS (SELECT");
    expect(sql).toContain("JOIN join_0 AS");
    expect(sql).not.toContain("JOIN (SELECT");
  });

  test("renders a self-join with distinct aliases", () => {
    const employees = table("employees", {
      id: t.int(),
      name: t.string(),
      manager_id: t.int(),
    });
    const managers = table("employees", {
      id: t.int(),
      name: t.string(),
      manager_id: t.int(),
    });
    const query = employees.join(
      managers,
      (employee, manager) => employee.manager_id.eq(manager.id),
      { merge: (employee, manager) => ({
        employee_id: employee.id,
        employee_name: employee.name,
        manager_name: manager.name,
      }) }
    );

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT);
  });

  test("renders a compact postgres pipeline", () => {
    const query = buildUserPipelineQuery();

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(USER_PIPELINE_POSTGRES_COMPACT);
  });

  test("renders a pretty postgres pipeline", () => {
    const query = buildUserPipelineQuery();

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "pretty" }))
    ).toBe(USER_PIPELINE_POSTGRES_PRETTY);
  });

  test("renders structured schema-qualified sources", () => {
    const events = table({ schema: "analytics", table: "events" }, { id: t.int() });

    expect(
      events.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
  });

  test("auto-quotes invalid source parts on postgresql", () => {
    const events = table(
      { schema: "analytics data", table: "events log", as: "events_alias" },
      { id: t.int() }
    );

    expect(
      events.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
  });

  test("auto-quotes invalid source parts on bigquery", () => {
    const events = table(
      { schema: "analytics data", table: "events log", as: "events_alias" },
      { id: t.int() }
    );

    expect(
      events.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT);
  });

  test("auto-quotes invalid source aliases", () => {
    const users = table({ table: "users", as: "user source" }, { id: t.int() });

    expect(
      users.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT);
  });

  test("toAst preserves auto-quoted source aliases on postgresql", () => {
    const users = table({ table: "users", as: "user source" }, { id: t.int() });
    const ast = users.toAst({ dialect: "postgresql" }) as any;
    const parser = new Parser();

    expect(ast.from[0].as).toEqual({ type: "default", value: '"user source"' });
    const sql = parser.sqlify(ast, { database: "PostgreSQL" });
    expect(sql).toContain('SELECT "user source"."id"');
    expect(sql).toContain('FROM users AS "user source"');
  });

  test("toAst preserves auto-quoted source parts on bigquery", () => {
    const events = table(
      { schema: "analytics data", table: "events log", as: "events_alias" },
      { id: t.int() }
    );
    const ast = events.toAst({ dialect: "bigquery" }) as any;
    const parser = new Parser();

    expect(ast.from[0].expr).toEqual({ type: "default", value: "`analytics data`.`events log`" });
    const sql = parser.sqlify(ast, { database: "BigQuery" });
    expect(sql).toContain("FROM `analytics data`.`events log` AS events_alias");
    expect(sql).toContain("SELECT events_alias.id");
  });

  test("applies sqlite language rewrites", () => {
    const users = table("users", { name: t.string() });
    const query = users.select((user) => ({
      len: user.name.characterLength(),
      bit_len: user.name.bitLength(),
    }));

    expect(
      query.toSql(sqlRenderer({ dialect: "sqlite", format: "compact" }))
    ).toBe(USERS_NAME_LENGTH_SQLITE_COMPACT);
  });

  test("auto-quotes invalid projected aliases on bigquery", () => {
    const users = table("users", { id: t.int() });
    const query = users.select((user) => ({
      ["source id"]: user.id,
    }));

    expect(
      query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT);
  });

  test("toAst preserves auto-quoted projected aliases on bigquery", () => {
    const users = table("users", { id: t.int() });
    const query = users.select((user) => ({
      ["source id"]: user.id,
    }));
    const ast = query.toAst({ dialect: "bigquery" }) as any;
    const parser = new Parser();

    expect(ast.columns[0].as).toEqual({ type: "default", value: "`source id`" });
    const sql = parser.sqlify(ast, { database: "BigQuery" });
    expect(sql).toContain("SELECT users_0.id AS `source id`");
    expect(sql).toContain("FROM users AS users_0");
  });

  test("preserves quoted projected column refs across derived-table barriers", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        ["Row Number"]: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row["Row Number"].eq(1));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT);
  });

  test("supports remeda pick() as a select callback on postgresql", () => {
    const users = createUsersTable();
    const query = users.select(R.pick(["id"]));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe("SELECT users_0.id FROM users AS users_0");
  });

  test("supports remeda omit() inside select shaping on postgresql", () => {
    const users = createUsersTable();
    const query = users.select((user) => ({
      ...R.omit(user, ["name"]),
      upper_name: user.name.upper(),
    }));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe("SELECT users_0.id, upper(users_0.name) AS upper_name FROM users AS users_0");
  });

  test("renders a window filter via QUALIFY on bigquery", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.row_num.eq(1));

    const sql = query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }));
    expect(sql).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);

    const parser = new Parser();
    expect(() => parser.astify(sql, { database: "BigQuery" })).not.toThrow();
  });

  test("inherits QUALIFY support from a custom BigQuery parser dialect", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.row_num.eq(1));

    expect(
      query.toSql(
        sqlRenderer({
          dialect: { name: "warehouse", parserDialect: "BigQuery" },
          format: "compact",
        })
      )
    ).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
  });

  test("uses a derived-table barrier for window filters on postgresql", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.row_num.eq(1));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
  });

  test("splits mixed predicates into WHERE and QUALIFY on bigquery", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.total.gt(10).and(row.row_num.eq(1)));

    expect(
      query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
  });

  test("splits mixed predicates around the derived-table window barrier", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.total.gt(10).and(row.row_num.eq(1)));

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
  });

  test("factors shared predicates across grouped window disjunctions on bigquery", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) =>
        row.total.gt(10).and(row.row_num.eq(1)).group().or(
          row.total.gt(10).and(row.row_num.eq(2)).group()
        )
      );

    expect(
      query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
  });

  test("factors shared predicates across grouped window disjunctions on postgresql", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) =>
        row.total.gt(10).and(row.row_num.eq(1)).group().or(
          row.total.gt(10).and(row.row_num.eq(2)).group()
        )
      );

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
  });

  test("normalizes negated window predicates into WHERE and QUALIFY on bigquery", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.total.gt(10).not().or(row.row_num.eq(1)).group().not());

    expect(
      query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
  });

  test("normalizes negated window predicates around the derived-table barrier", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.total.gt(10).not().or(row.row_num.eq(1)).group().not());

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
  });

  test("canonicalizes commutative shared disjunctions before window pushdown", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        total: order.total,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) =>
        row.total.gt(10).or(row.order_id.gt(5)).group().and(row.row_num.eq(1)).group().or(
          row.order_id.gt(5).or(row.total.gt(10)).group().and(row.row_num.eq(2)).group()
        )
      );

    expect(
      query.toSql(sqlRenderer({ dialect: "bigquery", format: "compact" }))
    ).toBe(ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
  });

  test("keeps order and limit outside the derived-table window barrier", () => {
    const orders = createOrdersTable();
    const query = orders
      .select((order) => ({
        order_id: order.order_id,
        row_num: order.order_id.rowNumber().over({ orderBy: order.order_id.asc() }),
      }))
      .filter((row) => row.row_num.eq(1))
      .orderBy((row) => row.order_id.asc())
      .limit(5);

    expect(
      query.toSql(sqlRenderer({ dialect: "postgresql", format: "compact" }))
    ).toBe(ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT);
  });
});
