import { param, postgresqlRenderer, table, t } from "../../mod.ts";

type Session = {
  tenantId: string;
};

type RequestLike = {
  url: string;
};

const orders = table("orders", {
  id: t.bigint(),
  tenant_id: t.uuid(),
  customer_email: t.string(),
  status: t.string(),
  total_cents: t.decimal(),
  created_at: t.timestamp(),
});

const renderer = postgresqlRenderer({
  format: "compact",
  parameterMode: "positional",
  parameterPrefix: "$",
});

export function handleListPaidOrders(request: RequestLike, session: Session) {
  const url = new URL(request.url, "https://app.example");
  const email = url.searchParams.get("email")?.trim() ?? "";
  const baseQuery = orders.filter((order) =>
    order.tenant_id.eq(param(session.tenantId)).and(order.status.eq("paid"))
  );
  const filteredQuery = email
    ? baseQuery.filter((order) => order.customer_email.eq(param(email)))
    : baseQuery;

  const result = filteredQuery
    .select((order) => ({
      id: order.id,
      customer_email: order.customer_email,
      total_cents: order.total_cents,
      created_at: order.created_at,
    }))
    .orderBy((order) => order.created_at.desc())
    .limit(25)
    .toSqlResult(renderer);

  return {
    status: 200,
    query: {
      text: result.sql,
      values: result.params.map((item) => item.value),
    },
  };
}

console.log(
  handleListPaidOrders(
    { url: "/api/orders?email=ada@example.com" },
    { tenantId: "00000000-0000-0000-0000-000000000001" }
  )
);
