import { pipe } from "remeda";
import { desc, eq, filter, limit, orderBy, param, postgresqlRenderer, select, t, table, toSqlResult } from "../../mod.ts";

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

  const baseQuery = pipe(
    orders,
    filter((order) => eq(order.tenant_id, param(session.tenantId))),
    filter((order) => eq(order.status, "paid"))
  );

  const filteredQuery = email
    ? pipe(baseQuery, filter((order) => eq(order.customer_email, param(email))))
    : baseQuery;

  const result = toSqlResult(
    pipe(
      filteredQuery,
      select((order) => ({
        id: order.id,
        customer_email: order.customer_email,
        total_cents: order.total_cents,
        created_at: order.created_at,
      })),
      orderBy((order) => desc(order.created_at)),
      limit(25)
    ),
    renderer
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
