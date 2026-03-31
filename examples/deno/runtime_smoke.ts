import { eq, filter, map, table, t, toSql } from "jsr:@teta/teta";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  tenant_id: t.uuid(),
  active: t.boolean(),
});

const query = map(
  filter(users, (user) => eq(user.active, true)),
  (user) => ({
    id: user.id,
    email: user.email,
    tenant_id: user.tenant_id,
  })
);

const sql = toSql(query, {
  dialect: "postgresql",
  format: "compact",
});

console.log(sql);
