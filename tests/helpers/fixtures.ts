import { table, t, filter, join, select, bitLength, characterLength, dateFormat, dateTrunc, eq, gte, isNull, and, loop, orderBy, replace, asc, coalesce, desc, limit } from "../../mod.ts";
export function createUsersTable() {
    return table("users", {
        id: t.int(),
        name: t.string(),
    });
}
export function createUsersPipelineTable() {
    return table("users", {
        id: t.int(),
        name: t.string(),
        age: t.int(),
        active: t.boolean(),
    });
}
export function createOrdersTable() {
    return table("orders", {
        order_id: t.int(),
        user_id: t.int(),
        total: t.float(),
    });
}
export function createEmployeesTable() {
    return table("employees", {
        id: t.int(),
        name: t.string(),
        manager_id: t.int(),
    });
}
export function createDialectUsersTable() {
    return table("users", {
        name: t.string(),
        created_at: t.timestamp(),
    });
}
export function buildUserPipelineQuery() {
    const users = createUsersPipelineTable();
    return limit(orderBy(select(filter(users, (user) => and(eq(user.active, true), gte(user.age, 18))), (user) => ({
        id: user.id,
        name: coalesce(replace(user.name, " ", "_"), "unknown"),
        age: user.age,
    })), (user) => [asc(user.name), desc(user.id)]), 20);
}
export function buildOrgTreeQuery() {
    const employees = createEmployeesTable();
    return loop(select(filter(employees, (employee) => isNull(employee.manager_id)), (employee) => ({
        id: employee.id,
        name: employee.name,
        manager_id: employee.manager_id,
    })), (self) => join(employees, self, (employee, current) => eq(employee.manager_id, current.id), { merge: (employee) => ({
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
        }) }));
}
export function buildDialectMatrixQuery() {
    const users = createDialectUsersTable();
    return select(users, (user) => ({
        len: characterLength(user.name),
        bit_len: bitLength(user.name),
        fmt: dateFormat(user.created_at, "%Y-%m-%d"),
    }));
}
export function buildLiveDialectQuery() {
    const users = createDialectUsersTable();
    return select(users, (user) => ({
        len: characterLength(user.name),
        bit_len: bitLength(user.name),
        day: dateTrunc(user.created_at, "day"),
        fmt: dateFormat(user.created_at, "%Y-%m-%d"),
    }));
}
