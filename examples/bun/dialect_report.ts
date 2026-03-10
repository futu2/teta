import { duckdbRenderer, postgresqlRenderer, table, t } from "../../mod.ts";

const events = table("events", {
  id: t.int(),
  account_id: t.uuid(),
  created_at: t.timestamp(),
  total_cents: t.decimal(),
});

const report = events
  .select((event) => ({
    id: event.id,
    account_id: event.account_id,
    created_day: event.created_at.dateTrunc("day"),
    total_cents: event.total_cents,
  }))
  .orderBy((event) => [event.created_day.desc(), event.id.desc()])
  .limit(20);

console.log("postgresql");
console.log(report.toSql(postgresqlRenderer({ format: "pretty" })));
console.log();
console.log("duckdb");
console.log(report.toSql(duckdbRenderer({ format: "pretty" })));
