import { param, sqlRenderer, table, t, filter, eq, select, and, limit, trim, lower, toSqlResult } from "../mod.ts";
const users = table("users", {
    id: t.int(),
    name: t.string(),
    active: t.boolean(),
});
const result = toSqlResult(limit(select(filter(users, (user) => and(eq(user.id, param(42)), eq(user.active, true))), (user) => ({
    id: user.id,
    normalized_name: lower(trim(user.name)),
})), 1), sqlRenderer({
    dialect: "postgresql",
    format: "compact",
}));
if (!result.sql.startsWith("SELECT ")) {
    throw new Error(`Expected SQL to start with SELECT, received: ${result.sql}`);
}
if (!result.sql.includes("WHERE")) {
    throw new Error(`Expected SQL to include WHERE, received: ${result.sql}`);
}
if (!result.sql.includes("LIMIT 1")) {
    throw new Error(`Expected SQL to include LIMIT 1, received: ${result.sql}`);
}
if (result.params.length !== 1 || result.params[0]?.value !== 42) {
    throw new Error(`Expected one bound param with value 42, received: ${JSON.stringify(result.params)}`);
}
console.log("runtime smoke ok");
