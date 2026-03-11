import { pipe } from "npm:remeda";
import { eq, filter, map, table, t, toSql } from "../../mod.ts";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  tenant_id: t.uuid(),
  active: t.boolean(),
});

const query = pipe(
  users,
  filter((user) => eq(user.active, true)),
  map((user) => ({
    id: user.id,
    email: user.email,
    tenant_id: user.tenant_id,
  }))
);

const sql = toSql(query, {
  dialect: "postgresql",
  format: "compact",
});

console.log(sql);
