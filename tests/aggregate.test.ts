import { describe, expect, test } from "bun:test";
import { omit } from "remeda";
import { fold, filter, leftJoin, count, eq, group, gt, sum, lt, toSql, and, or } from "../mod.ts";
import { ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT, ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT, ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT, ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT, ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT, USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT, QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT } from "./helpers/expected-sql.ts";
import { createOrdersTable, createUsersTable } from "./helpers/fixtures.ts";
describe("joins and aggregates", () => {
    test("renders a left join followed by fold grouping", () => {
        const users = createUsersTable();
        const orders = createOrdersTable();
        const query = fold(leftJoin(users, orders, (user, order) => eq(user.id, order.user_id)), (row) => ({
            user_id: group(row.id),
            order_count: count(row.order_id),
            total_spend: sum(row.total),
        }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(USERS_ORDERS_LEFT_JOIN_AGG_POSTGRES_COMPACT);
    });
    test("splits fold filters across WHERE and HAVING", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => ({
            user_id: group(order.user_id),
            total_spend: sum(order.total),
        })), (row) => and(gt(row.user_id, 10), gt(row.total_spend, 100)));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_TOTALS_WHERE_HAVING_POSTGRES_COMPACT);
    });
    test("factors shared predicates across grouped fold disjunctions", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => ({
            user_id: group(order.user_id),
            total_spend: sum(order.total),
        })), (row) => or(group(and(gt(row.user_id, 10), gt(row.total_spend, 100))), group(and(gt(row.user_id, 10), gt(row.total_spend, 200)))));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_TOTALS_WHERE_HAVING_OR_POSTGRES_COMPACT);
    });
    test("canonicalizes commutative shared disjunctions before fold pushdown", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => ({
            user_id: group(order.user_id),
            total_spend: sum(order.total),
        })), (row) => or(group(and(group(or(gt(row.user_id, 10), lt(row.user_id, 0))), gt(row.total_spend, 100))), group(and(group(or(lt(row.user_id, 0), gt(row.user_id, 10))), gt(row.total_spend, 200)))));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_USER_RANGE_HAVING_OR_POSTGRES_COMPACT);
    });
    test("renders fold filters as HAVING", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => ({
            user_id: group(order.user_id),
            total_spend: sum(order.total),
        })), (row) => gt(row.total_spend, 100));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT);
    });
    test("renders grouped aggregates after filtering", () => {
        const orders = createOrdersTable();
        const query = fold(filter(orders, (order) => gt(order.total, 0)), (order) => ({
            user_id: group(order.user_id),
            order_count: count(order.order_id),
            total_spend: sum(order.total),
        }));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_TOTALS_POSTGRES_COMPACT);
    });
    test("auto-quotes invalid fold output keys", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => ({
            ["User Id"]: group(order.user_id),
            ["Total Spend"]: sum(order.total),
        })), (row) => gt(row["Total Spend"], 100));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(QUOTED_TOTAL_SPEND_AGG_LIST_POSTGRES_COMPACT);
    });
    test("supports remeda omit() inside fold shaping", () => {
        const orders = createOrdersTable();
        const query = filter(fold(orders, (order) => omit({
            user_id: group(order.user_id),
            order_count: count(order.order_id),
            total_spend: sum(order.total),
        }, ["order_count"])), (row) => gt(row.total_spend, 100));
        expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(ORDERS_GROUPED_TOTALS_HAVING_POSTGRES_COMPACT);
    });
});
