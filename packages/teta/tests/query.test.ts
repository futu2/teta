import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";
import { omit, pick } from "remeda";
import { lit, table, t, filter, innerJoin, join, leftJoin, map, toAst, toSql, asc, bitLength, characterLength, eq, gt, replace, rowNumber, upper, sort, over, and, take, not, or, group, unnest } from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT, USER_PIPELINE_POSTGRES_PRETTY, USERS_NAME_LENGTH_SQLITE_COMPACT, EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT, USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT, USERS_SELECT_FILTER_POSTGRES_COMPACT, ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT, QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT, QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT, QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT, QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT, QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT, ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT, ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT } from "./helpers/expected-sql.ts";
import { buildUserPipelineQuery, createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("toSql(query, options)", () => {
    test("renders a joined map without an intermediate CTE", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = map(leftJoin(users, orders, (user, order) => eq(user.id, order.user_id)), (row) => ({
            user_id: row.id,
            total: row.total,
        }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
    });
    test("pushes a post-map filter into WHERE", () => {
        const users = createUsersTable();
        const query = filter(map(users, (user) => ({
            normalized_name: replace(user.name, " ", "_"),
        })), (row) => eq(row.normalized_name, "Ada_Lovelace"));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_SELECT_FILTER_POSTGRES_COMPACT);
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
        const query = join(users, (user) => map(filter(orders, (order) => eq(order.user_id, user.id)), (order) => ({
            order_id: order.id,
            total: order.total,
        })), () => lit(true), { lateral: true });
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("JOIN LATERAL (");
        expect(sql).toContain("WHERE orders_0.user_id = users_0.id");
    });
    test("renders postgres unnest as cross join lateral", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = unnest(sessions, (session) => session.tags, { value: "tag" });
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag FROM sessions AS sessions_0 CROSS JOIN LATERAL UNNEST(sessions_0.tags) AS unnest_1(tag)");
    });
    test("renders duckdb unnest as cross join", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = unnest(sessions, (session) => session.tags, { value: "tag" });
        expect(toSql(query, { dialect: "duckdb", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag FROM sessions AS sessions_0 CROSS JOIN UNNEST(sessions_0.tags) AS unnest_1(tag)");
    });
    test("renders hetu unnest as lateral view outer posexplode", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = unnest(sessions, (session) => session.tags, { value: "tag", ordinality: "idx" }, { outer: true });
        expect(toSql(query, { dialect: "hetu", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag, unnest_1.idx AS idx FROM sessions AS sessions_0 LATERAL VIEW OUTER POSEXPLODE(sessions_0.tags) unnest_1 AS idx, tag");
    });
    test("hoists a non-lateral subquery join into a CTE", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = join(users, map(filter(orders, (order) => gt(order.total, 0)), (order) => ({
            user_id: order.user_id,
            total: order.total,
        })), (user, order) => eq(user.id, order.user_id));
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
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
        const query = innerJoin(employees, managers, (employee, manager) => eq(employee.manager_id, manager.id), (employee, manager) => ({
            employee_id: employee.id,
            employee_name: employee.name,
            manager_name: manager.name,
        }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT);
    });
    test("renders a compact postgres pipeline", () => {
        const query = buildUserPipelineQuery();
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("renders a pretty postgres pipeline", () => {
        const query = buildUserPipelineQuery();
        expect(toSql(query, { dialect: "postgresql", format: "pretty" })).toBe(USER_PIPELINE_POSTGRES_PRETTY);
    });
    test("renders structured schema-qualified sources", () => {
        const events = table({ schema: "analytics", table: "events" }, { id: t.int() });
        expect(toSql(events, { dialect: "postgresql", format: "compact" })).toBe(ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
    });
    test("renders dotted string schema-qualified sources", () => {
        const events = table("analytics.events", { id: t.int() });
        expect(toSql(events, { dialect: "postgresql", format: "compact" })).toBe(ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
    });
    test("auto-quotes invalid source parts on postgresql", () => {
        const events = table({ schema: "analytics data", table: "events log", as: "events_alias" }, { id: t.int() });
        expect(toSql(events, { dialect: "postgresql", format: "compact" })).toBe(QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
    });
    test("auto-quotes invalid source parts on bigquery", () => {
        const events = table({ schema: "analytics data", table: "events log", as: "events_alias" }, { id: t.int() });
        expect(toSql(events, { dialect: "bigquery", format: "compact" })).toBe(QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT);
    });
    test("auto-quotes invalid source aliases", () => {
        const users = table({ table: "users", as: "user source" }, { id: t.int() });
        expect(toSql(users, { dialect: "postgresql", format: "compact" })).toBe(QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT);
    });
    test("toAst preserves auto-quoted source aliases on postgresql", () => {
        const users = table({ table: "users", as: "user source" }, { id: t.int() });
        const ast = toAst(users, { dialect: "postgresql" }) as any;
        const parser = new Parser();
        expect(ast.from[0].as).toEqual({ type: "default", value: '"user source"' });
        const sql = parser.sqlify(ast, { database: "PostgreSQL" });
        expect(sql).toContain('SELECT "user source"."id"');
        expect(sql).toContain('FROM users AS "user source"');
    });
    test("toAst preserves auto-quoted source parts on bigquery", () => {
        const events = table({ schema: "analytics data", table: "events log", as: "events_alias" }, { id: t.int() });
        const ast = toAst(events, { dialect: "bigquery" }) as any;
        const parser = new Parser();
        expect(ast.from[0].expr).toEqual({ type: "default", value: "`analytics data`.`events log`" });
        const sql = parser.sqlify(ast, { database: "BigQuery" });
        expect(sql).toContain("FROM `analytics data`.`events log` AS events_alias");
        expect(sql).toContain("SELECT events_alias.id");
    });
    test("applies sqlite language rewrites", () => {
        const users = table("users", { name: t.string() });
        const query = map(users, (user) => ({
            len: characterLength(user.name),
            bit_len: bitLength(user.name),
        }));
        expect(toSql(query, { dialect: "sqlite", format: "compact" })).toBe(USERS_NAME_LENGTH_SQLITE_COMPACT);
    });
    test("auto-quotes invalid projected aliases on bigquery", () => {
        const users = table("users", { id: t.int() });
        const query = map(users, (user) => ({
            ["source id"]: user.id,
        }));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT);
    });
    test("toAst preserves auto-quoted projected aliases on bigquery", () => {
        const users = table("users", { id: t.int() });
        const query = map(users, (user) => ({
            ["source id"]: user.id,
        }));
        const ast = toAst(query, { dialect: "bigquery" }) as any;
        const parser = new Parser();
        expect(ast.columns[0].as).toEqual({ type: "default", value: "`source id`" });
        const sql = parser.sqlify(ast, { database: "BigQuery" });
        expect(sql).toContain("SELECT users_0.id AS `source id`");
        expect(sql).toContain("FROM users AS users_0");
    });
    test("preserves quoted projected column refs across derived-table barriers", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            ["Row Number"]: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => eq(row["Row Number"], 1));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT);
    });
    test("supports remeda pick() as a map callback on postgresql", () => {
        const users = createUsersTable();
        const query = map(users, pick(["id"]));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id FROM users AS users_0");
    });
    test("supports remeda omit() inside map shaping on postgresql", () => {
        const users = createUsersTable();
        const query = map(users, (user) => ({
            ...omit(user, ["name"]),
            upper_name: upper(user.name),
        }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id, upper(users_0.name) AS upper_name FROM users AS users_0");
    });
    test("renders a window filter via QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => eq(row.row_num, 1));
        const sql = toSql(query, { dialect: "bigquery", format: "compact" });
        expect(sql).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
        const parser = new Parser();
        expect(() => parser.astify(sql, { database: "BigQuery" })).not.toThrow();
    });
    test("inherits QUALIFY support from a custom BigQuery parser dialect", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => eq(row.row_num, 1));
        expect(toSql(query, {
            dialect: { name: "warehouse", parserDialect: "BigQuery" },
            format: "compact",
        })).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("uses a derived-table barrier for window filters on postgresql", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => eq(row.row_num, 1));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("splits mixed predicates into WHERE and QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => and(gt(row.total, 10), eq(row.row_num, 1)));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("splits mixed predicates around the derived-table window barrier", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => and(gt(row.total, 10), eq(row.row_num, 1)));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("factors shared predicates across grouped window disjunctions on bigquery", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => or(group(and(gt(row.total, 10), eq(row.row_num, 1))), group(and(gt(row.total, 10), eq(row.row_num, 2)))));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("factors shared predicates across grouped window disjunctions on postgresql", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => or(group(and(gt(row.total, 10), eq(row.row_num, 1))), group(and(gt(row.total, 10), eq(row.row_num, 2)))));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("normalizes negated window predicates into WHERE and QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => not(group(or(not(gt(row.total, 10)), eq(row.row_num, 1)))));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("normalizes negated window predicates around the derived-table barrier", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => not(group(or(not(gt(row.total, 10)), eq(row.row_num, 1)))));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("canonicalizes commutative shared disjunctions before window pushdown", () => {
        const orders = createOrdersTable();
        const query = filter(map(orders, (order) => ({
            order_id: order.order_id,
            total: order.total,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => or(group(and(group(or(gt(row.total, 10), gt(row.order_id, 5))), eq(row.row_num, 1))), group(and(group(or(gt(row.order_id, 5), gt(row.total, 10))), eq(row.row_num, 2)))));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("keeps sort and take outside the derived-table window barrier", () => {
        const orders = createOrdersTable();
        const query = take(sort(filter(map(orders, (order) => ({
            order_id: order.order_id,
            row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
        })), (row) => eq(row.row_num, 1)), (row) => asc(row.order_id)), 5);
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT);
    });
});
