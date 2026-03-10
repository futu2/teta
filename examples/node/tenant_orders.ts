import { pipe } from "remeda";
import { desc, eq, filter, take, sort, param, postgresqlRenderer, map, t, table, toSqlResult } from "../../mod.ts";

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
  const result = toSqlResult(
    pipe(
      orders,
      filter((order) => eq(order.tenant_id, param(tenantId))),
      filter((order) => eq(order.customer_email, param(email))),
      filter((order) => eq(order.status, "paid")),
      map((order) => ({
        id: order.id,
        customer_email: order.customer_email,
        total_cents: order.total_cents,
      })),
      sort((order) => desc(order.id)),
      take(50)
    ),
    renderer
  );

  return {
    text: result.sql,
    values: result.params.map((param) => param.value),
  };
}

console.log(buildTenantOrdersQuery("00000000-0000-0000-0000-000000000001", "ada@example.com"));
