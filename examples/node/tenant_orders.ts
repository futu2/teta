import { param, postgresqlRenderer, table, t } from "../../mod.ts";

const orders = table("orders", {
  id: t.bigint(),
  tenant_id: t.uuid(),
  customer_email: t.string(),
  status: t.string(),
  total_cents: t.decimal(),
});

const renderer = postgresqlRenderer({
  format: "compact",
  parameterMode: "positional",
  parameterPrefix: "$",
});

export function buildTenantOrdersQuery(tenantId: string, email: string) {
  const result = orders
    .filter((order) =>
      order.tenant_id.eq(param(tenantId)).and(
        order.customer_email.eq(param(email)).and(order.status.eq("paid"))
      )
    )
    .select((order) => ({
      id: order.id,
      customer_email: order.customer_email,
      total_cents: order.total_cents,
    }))
    .orderBy((order) => order.id.desc())
    .limit(50)
    .toSqlResult(renderer);

  return {
    text: result.sql,
    values: result.params.map((param) => param.value),
  };
}

console.log(buildTenantOrdersQuery("00000000-0000-0000-0000-000000000001", "ada@example.com"));
