import { pipe } from "remeda";
import {
  and,
  asc,
  coalesce,
  dateTrunc,
  desc,
  eq,
  filter,
  join,
  lower,
  map,
  sort,
  table,
  t,
  take,
  toSql,
  trim,
} from "../packages/teta/mod.ts";
import type { SqlOptions } from "../packages/teta/mod.ts";

export type RenderBenchmarkCase = {
  label: string;
  options: SqlOptions;
};

export type RunRenderBenchmarkOptions = {
  runs?: number;
  warmupRuns?: number;
  samples?: number;
};

export type RenderBenchmarkMeasurement = {
  label: string;
  totalMs: number;
  msPerRender: number;
  sqlChars: number;
  sql: string;
  samples: number[];
};

const users = table("users", {
  id: t.int(),
  name: t.string(),
  active: t.boolean(),
  tenant_id: t.uuid(),
  spend_cents: t.decimal(),
});

const orders = table("orders", {
  id: t.bigint(),
  user_id: t.int(),
  status: t.string(),
  total_cents: t.decimal(),
  created_at: t.timestamp(),
});

export const renderBenchmarkQuery = pipe(
  join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "left" }),
  filter((row) => and(eq(row.active, true), eq(row.status, "paid"))),
  map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    normalized_name: lower(trim(row.name)),
    spend_cents: row.spend_cents,
    total_cents: coalesce(row.total_cents, 0),
    created_day: dateTrunc(row.created_at, "day"),
  })),
  sort((row) => [desc(row.created_day), asc(row.id)]),
  take(100)
);

export const renderBenchmarkCases: RenderBenchmarkCase[] = [
  {
    label: "postgresql/optimized",
    options: { dialect: "postgresql", format: "compact", renderStrategy: "optimized" },
  },
  {
    label: "postgresql/readable",
    options: { dialect: "postgresql", format: "compact", renderStrategy: "readable" },
  },
  {
    label: "duckdb/optimized",
    options: { dialect: "duckdb", format: "compact", renderStrategy: "optimized" },
  },
  {
    label: "sqlite/optimized",
    options: { dialect: "sqlite", format: "compact", renderStrategy: "optimized" },
  },
];

export function runRenderBenchmark(
  options: RunRenderBenchmarkOptions = {}
): RenderBenchmarkMeasurement[] {
  const runs = options.runs ?? 1000;
  const warmupRuns = options.warmupRuns ?? 200;
  const samples = options.samples ?? 5;

  return renderBenchmarkCases.map((benchmarkCase) => {
    for (let warmupIndex = 0; warmupIndex < warmupRuns; warmupIndex += 1) {
      toSql(renderBenchmarkQuery, benchmarkCase.options);
    }

    const sampleDurations: number[] = [];
    let lastSql = "";
    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      const start = performance.now();
      for (let runIndex = 0; runIndex < runs; runIndex += 1) {
        lastSql = toSql(renderBenchmarkQuery, benchmarkCase.options);
      }
      const elapsed = performance.now() - start;
      sampleDurations.push(elapsed / runs);
    }

    const msPerRender = median(sampleDurations);
    return {
      label: benchmarkCase.label,
      totalMs: msPerRender * runs,
      msPerRender,
      sqlChars: lastSql.length,
      sql: lastSql,
      samples: sampleDurations,
    };
  });
}

export function formatRenderBenchmarkMeasurement(
  measurement: RenderBenchmarkMeasurement
): string {
  return `${measurement.label}: ${measurement.totalMs.toFixed(2)}ms total, ${measurement.msPerRender.toFixed(4)}ms/render, ${measurement.sqlChars} chars`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}
