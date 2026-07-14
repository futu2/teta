import { describe, expect, test } from "bun:test";
import { Parser } from "node-sql-parser";
import { lit, table, t, filter, innerJoin, innerJoinMap, innerJoinMerge, leftJoin, map, toAst, toSql, asc, bitLength, characterLength, dateAdd, eq, gt, replace, rowNumber, upper, sort, over, and, take, not, or, group, unnest, dropOverlapLeft, usingCols, asBigInt, asBoolean, asBytes, asDate, asDecimal, asFloat, asInt, asJson, asString, asTimestamp, asUuid, pipe, loop, union, unionAll, pick } from "../mod.ts";
import { USER_PIPELINE_POSTGRES_COMPACT, USER_PIPELINE_POSTGRES_PRETTY, USERS_NAME_LENGTH_SQLITE_COMPACT, EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT, USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT, USERS_SELECT_FILTER_POSTGRES_COMPACT, ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT, QUOTED_ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT, QUOTED_ANALYTICS_EVENTS_SELECT_BIGQUERY_COMPACT, QUOTED_USERS_ALIAS_SELECT_POSTGRES_COMPACT, QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT, QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT, ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT, ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT, ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT, ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT } from "./helpers/expected-sql.ts";
import { buildUserPipelineQuery, createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("toSql(query, options)", () => {
    test("renders a joined map without an intermediate CTE", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = pipe(
            users,
            leftJoin(
                orders,
                (user, order) => eq(user.id, order.user_id)
            ),
            map((row) => ({
                user_id: row.id,
                total: row.total,
            }))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_SELECT_POSTGRES_COMPACT);
    });
    test("pushes a post-map filter into WHERE", () => {
        const users = createUsersTable();
        const query = pipe(
            users,
            map((user) => ({
                normalized_name: replace(user.name, " ", "_"),
            })),
            filter((row) => eq(row.normalized_name, "Ada_Lovelace"))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_SELECT_FILTER_POSTGRES_COMPACT);
    });
    test("wraps earlier disjunctions when chained filters are merged", () => {
        const users = table("users", {
            id: t.int(),
            active: t.boolean(),
        });
        const query = pipe(
            users,
            filter((user) => or(eq(user.id, 1), eq(user.id, 2))),
            filter((user) => eq(user.active, true))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id AS id, users_0.active AS active FROM users AS users_0 WHERE (users_0.id = 1 OR users_0.id = 2) AND users_0.active = TRUE");
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
        const query = pipe(
            users,
            innerJoin(
                (user) => pipe(
                    orders,
                    filter((order) => eq(order.user_id, user.id)),
                    map((order) => ({
                        order_id: order.id,
                        total: order.total,
                    }))
                ),
                () => lit(true),
                { lateral: true }
            )
        );
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("JOIN LATERAL (");
        expect(sql).toContain("WHERE orders_0.user_id = users_0.id");
    });
    test("does not invoke built-query join predicates before applying the query step", () => {
        const users = table("users", {
            id: t.int(),
        });
        const orders = table("orders", {
            user_id: t.int(),
        });
        let predicateCalls = 0;
        const step = innerJoin(orders, () => {
            predicateCalls += 1;
            return lit(true);
        });
        expect(predicateCalls).toBe(0);
        const query = pipe(users, step);
        expect(predicateCalls).toBe(1);
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toContain("INNER JOIN orders AS");
    });
    test("keeps function-right curried joins as lateral joins", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const orders = table("orders", {
            id: t.int(),
            user_id: t.int(),
            total: t.float(),
        });
        const query = pipe(
            users,
            innerJoin(
                (_user) => pipe(orders, map((order) => ({
                    user_id: order.user_id,
                    total: order.total,
                }))),
                () => lit(true)
            )
        );
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("JOIN LATERAL (");
        expect(sql).not.toContain("WITH join_0(");
    });
    test("invokes ambiguous function-right callback only once", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const orders = table("orders", {
            id: t.int(),
            user_id: t.int(),
            total: t.float(),
        });
        let n = 0;
        const query = pipe(
            users,
            innerJoin(
                () => pipe(orders, map((_order) => ({
                    seq: ++n,
                }))),
                () => lit(true)
            )
        );
        expect(n).toBe(1);
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("JOIN LATERAL (");
    });
    test("renders postgres unnest as cross join lateral", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag FROM sessions AS sessions_0 CROSS JOIN LATERAL UNNEST(sessions_0.tags) AS unnest_1(tag)");
    });
    test("renders duckdb unnest as cross join", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
        expect(toSql(query, { dialect: "duckdb", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag FROM sessions AS sessions_0 CROSS JOIN UNNEST(sessions_0.tags) AS unnest_1(tag)");
    });
    test("renders trino unnest as lateral view outer posexplode", () => {
        const sessions = table("sessions", {
            id: t.int(),
            tags: t.array(t.string()),
        });
        const query = pipe(sessions, unnest((session) => session.tags, { value: "tag", ordinality: "idx" }, { outer: true }));
        expect(toSql(query, { dialect: "trino", format: "compact" })).toBe("SELECT sessions_0.id AS id, sessions_0.tags AS tags, unnest_1.tag AS tag, unnest_1.idx AS idx FROM sessions AS sessions_0 LATERAL VIEW OUTER POSEXPLODE(sessions_0.tags) unnest_1 AS idx, tag");
    });
    test("hoists a non-lateral subquery join into a CTE", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = pipe(
            users,
            innerJoin(
                pipe(
                    orders,
                    filter((order) => gt(order.total, 0)),
                    map((order) => ({
                        user_id: order.user_id,
                        total: order.total,
                    }))
                ),
                (user, order) => eq(user.id, order.user_id)
            )
        );
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("WITH join_0(user_id, total) AS (SELECT");
        expect(sql).toContain("JOIN join_0 AS");
        expect(sql).not.toContain("JOIN (SELECT");
    });
    test("dedupes identical hoisted join subqueries", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const positiveOrders = pipe(
            orders,
            filter((order) => gt(order.total, 0)),
            map((order) => ({
                user_id: order.user_id,
                total: order.total,
            }))
        );
        const joinedOnce = pipe(
            users,
            innerJoinMap(
                positiveOrders,
                (user, order) => eq(user.id, order.user_id),
                (user, order) => ({
                    id: user.id,
                    first_total: order.total,
                })
            )
        );
        const query = pipe(
            joinedOnce,
            innerJoinMap(
                positiveOrders,
                (row, order) => eq(row.id, order.user_id),
                (row, order) => ({
                    id: row.id,
                    first_total: row.first_total,
                    second_total: order.total,
                })
            )
        );
        const sql = toSql(query, { dialect: "postgresql", format: "compact" });
        expect(sql).toContain("WITH join_0(user_id, total) AS (SELECT");
        expect(sql).not.toContain("join_1(");
        expect(sql.match(/JOIN join_0 AS /g)?.length).toBe(2);
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
        const query = pipe(
            employees,
            innerJoinMap(
                managers,
                (employee, manager) => eq(employee.manager_id, manager.id),
                (employee, manager) => ({
                    employee_id: employee.id,
                    employee_name: employee.name,
                    manager_name: manager.name,
                })
            )
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(EMPLOYEES_SELF_JOIN_POSTGRES_COMPACT);
    });
    test("renders join with usingCols helper and dropOverlapLeft merge", () => {
        const users = table("users", {
            id: t.int(),
        });
        const profiles = table("profiles", {
            id: t.int(),
            bio: t.string(),
        });
        const query = pipe(
            users,
            innerJoinMerge(
                profiles,
                usingCols("id"),
                dropOverlapLeft()
            )
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT profiles_1.id AS id, profiles_1.bio AS bio FROM users AS users_0 INNER JOIN profiles AS profiles_1 ON users_0.id = profiles_1.id");
    });
    test("renders cast helpers as plain CAST expressions", () => {
        const events = table("events", {
            user_id: t.int(),
            event_date: t.date(),
            event_ts: t.timestamp(),
        });
        const query = pipe(events, map((event) => ({
            user_id_txt: asString(event.user_id),
            event_ts: asTimestamp(event.event_date),
            passthrough_ts: asTimestamp(event.event_ts),
        })));
        const expectedSql = "SELECT CAST(events_0.user_id AS VARCHAR) AS user_id_txt, CAST(events_0.event_date AS TIMESTAMP) AS event_ts, CAST(events_0.event_ts AS TIMESTAMP) AS passthrough_ts FROM events AS events_0";
        expect(toSql(query, { dialect: "duckdb", format: "compact" })).toBe(expectedSql);
        expect(toSql(query, { dialect: "sqlite", format: "compact" })).toBe(expectedSql);
    });
    test("renders as-cast helpers as plain CAST expressions", () => {
        const events = table("events", {
            user_id: t.int(),
            raw_count: t.string(),
            raw_total: t.string(),
            raw_flag: t.string(),
            raw_date: t.string(),
            raw_ts: t.string(),
            raw_uuid: t.string(),
            raw_blob: t.string(),
            raw_json: t.string(),
        });
        const query = pipe(events, map((event) => ({
            user_id_txt: asString(event.user_id),
            count_int: asInt(event.raw_count),
            count_bigint: asBigInt(event.raw_count),
            total_float: asFloat(event.raw_total),
            total_decimal: asDecimal(event.raw_total),
            flag_bool: asBoolean(event.raw_flag),
            created_date: asDate(event.raw_date),
            created_ts: asTimestamp(event.raw_ts),
            event_uuid: asUuid(event.raw_uuid),
            payload_bytes: asBytes(event.raw_blob),
            payload_json: asJson(event.raw_json),
        })));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT CAST(events_0.user_id AS VARCHAR) AS user_id_txt, CAST(events_0.raw_count AS INTEGER) AS count_int, CAST(events_0.raw_count AS BIGINT) AS count_bigint, CAST(events_0.raw_total AS FLOAT) AS total_float, CAST(events_0.raw_total AS DECIMAL) AS total_decimal, CAST(events_0.raw_flag AS BOOLEAN) AS flag_bool, CAST(events_0.raw_date AS DATE) AS created_date, CAST(events_0.raw_ts AS TIMESTAMP) AS created_ts, CAST(events_0.raw_uuid AS UUID) AS event_uuid, CAST(events_0.raw_blob AS BLOB) AS payload_bytes, CAST(events_0.raw_json AS JSON) AS payload_json FROM events AS events_0");
    });
    test("renders Hive dateAdd through Hive-supported primitives", () => {
        const events = table("events", {
            event_ts: t.timestamp(),
        });
        const query = pipe(events, map((event) => ({
            plus_days: dateAdd(event.event_ts, "day", 2),
            plus_months: dateAdd(event.event_ts, "month", 2),
        })));
        expect(toSql(query, { dialect: "hive", format: "compact" })).toBe("SELECT CAST(from_unixtime(unix_timestamp(events_0.event_ts) + 2 * 86400) AS TIMESTAMP) AS plus_days, CAST(concat(CAST(add_months(CAST(events_0.event_ts AS DATE), 2) AS STRING), ' ', date_format(events_0.event_ts, 'HH:mm:ss')) AS TIMESTAMP) AS plus_months FROM events AS events_0");
    });
    test("renders a compact postgres pipeline", () => {
        const query = buildUserPipelineQuery();
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });
    test("renders a pretty postgres pipeline", () => {
        const query = buildUserPipelineQuery();
        expect(toSql(query, { dialect: "postgresql", format: "pretty" })).toBe(USER_PIPELINE_POSTGRES_PRETTY);
    });
    test("supports curried union helpers without external currying", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const archivedUsers = table("archived_users", {
            id: t.int(),
            name: t.string(),
        });
        const unioned = pipe(users, union(archivedUsers));
        const unionedAll = pipe(users, unionAll(archivedUsers));
        expect(toSql(unioned, { dialect: "postgresql", format: "compact" })).toContain(" UNION ");
        expect(toSql(unionedAll, { dialect: "postgresql", format: "compact" })).toContain(" UNION ALL ");
    });
    test("validates current union helper shapes", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const archivedUsers = table("archived_users", {
            id: t.int(),
            name: t.string(),
        });

        expect(() => (union as any)()).toThrow("union() expects union(right)");
        expect(() => (union as any)("not a query")).toThrow("union() expects union(right)");
        expect(() => (union as any)(users, archivedUsers)).toThrow("union() expects union(right)");
        expect(() => (union as any)(users, archivedUsers, archivedUsers)).toThrow("union() expects union(right)");
        expect(() => (unionAll as any)()).toThrow("unionAll() expects unionAll(right)");
        expect(() => (unionAll as any)("not a query")).toThrow("unionAll() expects unionAll(right)");
        expect(() => (unionAll as any)(users, archivedUsers)).toThrow("unionAll() expects unionAll(right)");
        expect(() => (unionAll as any)(users, archivedUsers, archivedUsers)).toThrow("unionAll() expects unionAll(right)");
    });
    test("supports curried loop helper without external currying", () => {
        const seed = pipe(
            table("seed", { n: t.int() }),
            map((row) => ({ n: row.n }))
        );
        const recursive = pipe(
            seed,
            loop((self) => pipe(self, filter((row) => gt(row.n, 0))))
        );
        expect(toSql(recursive, { dialect: "postgresql", format: "compact" })).toContain("WITH RECURSIVE");
    });
    test("validates current loop helper shape", () => {
        const seed = pipe(
            table("seed", { n: t.int() }),
            map((row) => ({ n: row.n }))
        );
        const step = (self: typeof seed) => pipe(self, filter((row) => gt(row.n, 0)));

        expect(() => (loop as any)()).toThrow("loop() expects loop(step)");
        expect(() => (loop as any)("not a callback")).toThrow("loop() expects loop(step)");
        expect(() => (loop as any)(seed, step)).toThrow("loop() expects loop(step)");
        expect(() => (loop as any)(seed, step, step)).toThrow("loop() expects loop(step)");
    });
    test("renders structured schema-qualified sources", () => {
        const events = table({ schema: "analytics", table: "events" }, { id: t.int() });
        expect(toSql(events, { dialect: "postgresql", format: "compact" })).toBe(ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
    });
    test("renders dotted string schema-qualified sources", () => {
        const events = table("analytics.events", { id: t.int() });
        expect(toSql(events, { dialect: "postgresql", format: "compact" })).toBe(ANALYTICS_EVENTS_SELECT_POSTGRES_COMPACT);
    });
    test("renders uppercase dotted string schema-qualified sources", () => {
        const source = table("SCHEMANAME1.TABLENAME1", { id: t.int() });
        expect(toSql(source, { dialect: "postgresql", format: "compact" })).toBe('SELECT "TABLENAME1_0".id FROM "SCHEMANAME1"."TABLENAME1" AS "TABLENAME1_0"');
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
        const query = pipe(users, map((user) => ({
            len: characterLength(user.name),
            bit_len: bitLength(user.name),
        })));
        expect(toSql(query, { dialect: "sqlite", format: "compact" })).toBe(USERS_NAME_LENGTH_SQLITE_COMPACT);
    });
    test("auto-quotes invalid projected aliases on bigquery", () => {
        const users = table("users", { id: t.int() });
        const query = pipe(users, map((user) => ({
            ["source id"]: user.id,
        })));
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(QUOTED_USERS_PROJECTED_ALIAS_BIGQUERY_COMPACT);
    });
    test("toAst preserves auto-quoted projected aliases on bigquery", () => {
        const users = table("users", { id: t.int() });
        const query = pipe(users, map((user) => ({
            ["source id"]: user.id,
        })));
        const ast = toAst(query, { dialect: "bigquery" }) as any;
        const parser = new Parser();
        expect(ast.columns[0].as).toEqual({ type: "default", value: "`source id`" });
        const sql = parser.sqlify(ast, { database: "BigQuery" });
        expect(sql).toContain("SELECT users_0.id AS `source id`");
        expect(sql).toContain("FROM users AS users_0");
    });
    test("preserves quoted projected column refs across derived-table barriers", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                ["Row Number"]: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => eq(row["Row Number"], 1))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(QUOTED_ROW_NUMBER_ALIAS_FILTER_POSTGRES_COMPACT);
    });
    test("supports pick() as a query step on postgresql", () => {
        const users = createUsersTable();
        const query = pipe(users, pick("id"));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id FROM users AS users_0");
    });
    test("supports explicit omission inside map shaping on postgresql", () => {
        const users = createUsersTable();
        const query = pipe(users, map((user) => ({
            id: user.id,
            upper_name: upper(user.name),
        })));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe("SELECT users_0.id, upper(users_0.name) AS upper_name FROM users AS users_0");
    });
    test("renders a window filter via QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => eq(row.row_num, 1))
        );
        const sql = toSql(query, { dialect: "bigquery", format: "compact" });
        expect(sql).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
        const parser = new Parser();
        expect(() => parser.astify(sql, { database: "BigQuery" })).not.toThrow();
    });
    test("inherits QUALIFY support from a custom BigQuery parser dialect", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => eq(row.row_num, 1))
        );
        expect(toSql(query, {
            dialect: { name: "warehouse", parserDialect: "BigQuery" },
            format: "compact",
        })).toBe(ORDERS_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("uses a derived-table barrier for window filters on postgresql", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => eq(row.row_num, 1))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("splits mixed predicates into WHERE and QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => and(gt(row.total, 10), eq(row.row_num, 1)))
        );
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("splits mixed predicates around the derived-table window barrier", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => and(gt(row.total, 10), eq(row.row_num, 1)))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("factors shared predicates across grouped window disjunctions on bigquery", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => or(group(and(gt(row.total, 10), eq(row.row_num, 1))), group(and(gt(row.total, 10), eq(row.row_num, 2)))))
        );
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("factors shared predicates across grouped window disjunctions on postgresql", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => or(group(and(gt(row.total, 10), eq(row.row_num, 1))), group(and(gt(row.total, 10), eq(row.row_num, 2)))))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_SHARED_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("normalizes negated window predicates into WHERE and QUALIFY on bigquery", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => not(group(or(not(gt(row.total, 10)), eq(row.row_num, 1)))))
        );
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("normalizes negated window predicates around the derived-table barrier", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => not(group(or(not(gt(row.total, 10)), eq(row.row_num, 1)))))
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_TOTAL_NOT_ROW_NUMBER_FILTER_POSTGRES_COMPACT);
    });
    test("canonicalizes commutative shared disjunctions before window pushdown", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                total: order.total,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => or(group(and(group(or(gt(row.total, 10), gt(row.order_id, 5))), eq(row.row_num, 1))), group(and(group(or(gt(row.order_id, 5), gt(row.total, 10))), eq(row.row_num, 2)))))
        );
        expect(toSql(query, { dialect: "bigquery", format: "compact" })).toBe(ORDERS_SHARED_DISJUNCTION_ROW_NUMBER_QUALIFY_BIGQUERY_COMPACT);
    });
    test("keeps sort and take outside the derived-table window barrier", () => {
        const orders = createOrdersTable();
        const query = pipe(
            orders,
            map((order) => ({
                order_id: order.order_id,
                row_num: over(rowNumber(order.order_id), { orderBy: asc(order.order_id) }),
            })),
            filter((row) => eq(row.row_num, 1)),
            sort((row) => asc(row.order_id)),
            take(5)
        );
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_ROW_NUMBER_FILTER_ORDER_LIMIT_POSTGRES_COMPACT);
    });
});
