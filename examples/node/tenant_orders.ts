import { desc, eq, filter, take, sort, param, map, t, table, toSqlResult, pipe } from "@teta/teta";

const orders = table("orders", {
  id: t.bigint(),
  tenant_id: t.uuid(),
  customer_email: t.string(),
  status: t.string(),
  total_cents: t.decimal(),
});

const sqlOptions = {
  dialect: "postgresql",
  format: "compact",
  parameterMode: "positional",
  parameterPrefix: "$",
} as const;

export function buildTenantOrdersQuery(tenantId: string, email: string) {
  const result = toSqlResult(
    pipe(
      orders,
      filter((order) => eq(order.tenant_id, param<string>("tenant_id"))),
      filter((order) => eq(order.customer_email, param<string>("email"))),
      filter((order) => eq(order.status, "paid")),
      map((order) => ({
        id: order.id,
        customer_email: order.customer_email,
        total_cents: order.total_cents,
      })),
      sort((order) => desc(order.id)),
      take(50)
    ),
    { ...sqlOptions, params: { tenant_id: tenantId, email } }
  );

  return {
    text: result.sql,
    values: result.params.map((param) => param.value),
  };
}
