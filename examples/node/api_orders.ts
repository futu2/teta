import { desc, eq, filter, take, sort, param, map, t, table, toSqlResult, pipe } from "@teta/teta";

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

const sqlOptions = {
  dialect: "postgresql",
  format: "compact",
  parameterMode: "positional",
  parameterPrefix: "$",
} as const;

export function handleListPaidOrders(request: RequestLike, session: Session) {
  const url = new URL(request.url, "https://app.example");
  const email = url.searchParams.get("email")?.trim() ?? "";

  const baseQuery = pipe(
    orders,
    filter((order) => eq(order.tenant_id, param("tenant_id", t.uuid()))),
    filter((order) => eq(order.status, "paid"))
  );

  const filteredQuery = email
    ? pipe(baseQuery, filter((order) => eq(order.customer_email, param("email", t.string()))))
    : baseQuery;

  const result = toSqlResult(
    pipe(
      filteredQuery,
      map((order) => ({
        id: order.id,
        customer_email: order.customer_email,
        total_cents: order.total_cents,
        created_at: order.created_at,
      })),
      sort((order) => desc(order.created_at)),
      take(25)
    ),
    { ...sqlOptions, params: { tenant_id: session.tenantId, email } }
  );

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
