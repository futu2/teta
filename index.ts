import { table, t } from "./src/edsl";

const users = table(
  "users",
  {
    id: t.number(),
    name: t.string(),
    age: t.number(),
    active: t.boolean(),
  },
  { schema: "analytics" }
);

const orders = table("sales.orders", {
  order_id: t.number(),
  user_id: t.number(),
  total: t.number(),
});

const joined = users
  .leftJoin(orders, (u, o) => u.id.eq(o.user_id))
  .select((u) => ({
    user_id: u.id,
    user_name: u.name.replace(" ", "_").coalesce("unknown"),
    order_id: u.order_id,
    total: u.total,
  }));

const aggregated = joined
  .filter((u) => u.total.gt(0))
  .aggregate((u) => ({
    user_id: u.user_id.group(),
    order_count: u.order_id.count(),
    total_spend: u.total.sum(),
  }))
  .select((u) => ({
    ...u,
    spend_rank: u.total_spend.rank().over({ orderBy: u.total_spend.desc() }),
  }))
  .orderBy((u) => u.total_spend.desc())
  .limit(10);

console.log(aggregated.toIR());
console.log(JSON.stringify(aggregated.toAst(), null, 2));
console.log(aggregated.toSql("postgresql","pretty"));
