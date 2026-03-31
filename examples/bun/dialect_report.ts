import { pipe } from "remeda";
import { dateTrunc, desc, take, sort, map, table, t, toSql } from "@teta/teta";

const events = table("events", {
  id: t.int(),
  account_id: t.uuid(),
  created_at: t.timestamp(),
  total_cents: t.decimal(),
});

const report = pipe(
  events,
  map((event) => ({
    id: event.id,
    account_id: event.account_id,
    created_day: dateTrunc(event.created_at, "day"),
    total_cents: event.total_cents,
  })),
  sort((event) => [desc(event.created_day), desc(event.id)]),
  take(20)
);

console.log("postgresql");
console.log(toSql(report, { dialect: "postgresql", format: "pretty" }));
console.log();
console.log("duckdb");
console.log(toSql(report, { dialect: "duckdb", format: "pretty" }));
