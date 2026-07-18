import { param, table, t, filter, eq, map, and, take, trim, lower, toSqlResult, pipe } from "../mod.ts";
const users = table("users", {
    id: t.int(),
    name: t.string(),
    active: t.boolean(),
});
const result = toSqlResult(pipe(
    users,
    filter((user) => and(eq(user.id, param("id", t.int())), eq(user.active, true))),
    map((user) => ({
        id: user.id,
        normalized_name: lower(trim(user.name)),
    })),
    take(1)
), {
    dialect: "postgresql",
    format: "compact",
    params: { id: 42 },
});
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
