import { eq, filter, select, sqlRenderer, table, t, toSql } from "../../mod.ts";

const users = table("users", {
  id: t.int(),
  email: t.string(),
  tenant_id: t.uuid(),
  active: t.boolean(),
});

const sql = toSql(select(filter(users, (user) => eq(user.active, true)), (user) => ({
    id: user.id,
    email: user.email,
    tenant_id: user.tenant_id,
  })), sqlRenderer({
    dialect: "postgresql",
    format: "compact",
  }));

console.log(sql);
