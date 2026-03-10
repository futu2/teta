import { dateTrunc, desc, duckdbRenderer, limit, orderBy, postgresqlRenderer, select, table, t, toSql } from "../../mod.ts";

const events = table("events", {
  id: t.int(),
  account_id: t.uuid(),
  created_at: t.timestamp(),
  total_cents: t.decimal(),
});

const report = limit(orderBy(select(events, (event) => ({
    id: event.id,
    account_id: event.account_id,
    created_day: dateTrunc(event.created_at, "day"),
    total_cents: event.total_cents,
  })), (event) => [desc(event.created_day), desc(event.id)]), 20);

console.log("postgresql");
console.log(toSql(report, postgresqlRenderer({ format: "pretty" })));
console.log();
console.log("duckdb");
console.log(toSql(report, duckdbRenderer({ format: "pretty" })));
