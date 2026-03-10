import { param, sqlRenderer, table, t } from "../mod.ts";

const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
});

const result = users
  .filter((user) => user.id.eq(param(42)).and(user.active.eq(true)))
  .select((user) => ({
    id: user.id,
    normalized_name: user.name.trim().lower(),
  }))
  .limit(1)
  .toSqlResult(sqlRenderer({
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
