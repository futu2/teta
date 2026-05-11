import { pipe } from "remeda";
import { eq, filter, map, table, t, toSqlResult } from "jsr:@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  tenant_id: t.uuid(),
  active: t.boolean(),
});

const result = toSqlResult(
  pipe(
    users,
    filter((user) => eq(user.active, true)),
    map((user) => ({
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
    }))
  ),
  {
    dialect: "postgresql",
    format: "compact",
  }
);

console.log(result.sql);
