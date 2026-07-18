import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import fc from "fast-check";
import { irToSql, lowerPortableQueryIR, validateQueryIR } from "@teta/sql";

import {
  asc,
  distinct,
  eq,
  filter,
  gt,
  map,
  pipe,
  sort,
  take,
  toIR,
  toSql,
  values,
  whenStep,
} from "../mod.ts";
import { canonicalizeIR } from "../src/edsl/query/canonicalize.ts";
import type { LogicalStage } from "../src/edsl/query/logical.ts";
import { normalizeStages } from "../src/edsl/query/normalize.ts";

const logicalStageArbitrary: fc.Arbitrary<LogicalStage> = fc.oneof(
  fc.integer({ min: 0, max: 100 }).map((count) => ({ kind: "take" as const, count })),
  fc.constant({ kind: "distinct" as const }),
  fc.boolean().map((value) => ({
    kind: "filter" as const,
    predicate: { kind: "literal" as const, value },
  }))
);

type GeneratedRow = { id: number; score: number; active: boolean };
const rowArbitrary: fc.Arbitrary<GeneratedRow> = fc.record({
  id: fc.integer({ min: 0, max: 30 }),
  score: fc.integer({ min: -100, max: 100 }),
  active: fc.boolean(),
});

describe("property-based compiler laws", () => {
  test("logical normalization is idempotent", () => {
    fc.assert(fc.property(
      fc.array(logicalStageArbitrary, { maxLength: 30 }),
      (stages) => {
        const once = normalizeStages(stages);
        expect(normalizeStages(once)).toEqual(once);
      }
    ), { numRuns: 200 });
  });

  test("IR canonicalization is idempotent and JSON-portable", () => {
    fc.assert(fc.property(
      fc.array(rowArbitrary, { minLength: 1, maxLength: 12 }),
      fc.integer({ min: -100, max: 100 }),
      (rows, threshold) => {
        const query = pipe(
          values(asNonEmptyRows(rows)),
          filter((row) => gt(row.score, threshold)),
          map((row) => ({ id: row.id, score: row.score }))
        );
        const ir = toIR(query);
        const canonical = canonicalizeIR(lowerPortableQueryIR(ir));
        expect(canonicalizeIR(canonical)).toEqual(canonical);

        const decoded = JSON.parse(JSON.stringify(ir));
        validateQueryIR(decoded);
        expect(toSql(query, { dialect: "sqlite", format: "compact" })).toBe(
          toSqlFromPortable(decoded)
        );
      }
    ), { numRuns: 100 });
  });

  test("optimized and readable plans are observationally equivalent", () => {
    fc.assert(fc.property(
      fc.array(rowArbitrary, { minLength: 1, maxLength: 20 }),
      fc.record({
        activeOnly: fc.boolean(),
        threshold: fc.integer({ min: -100, max: 100 }),
        deduplicate: fc.boolean(),
        count: fc.integer({ min: 0, max: 20 }),
      }),
      (rows, config) => {
        const query = pipe(
          values(asNonEmptyRows(rows)),
          whenStep(config.activeOnly, filter((row) => eq(row.active, true))),
          map((row) => ({ id: row.id, score: row.score })),
          filter((row) => gt(row.score, config.threshold)),
          sort((row) => [asc(row.score), asc(row.id)]),
          whenStep(config.deduplicate, distinct()),
          take(config.count)
        );

        const database = new Database(":memory:");
        try {
          const optimized = database.query(toSql(query, {
            dialect: "sqlite",
            format: "compact",
            renderStrategy: "optimized",
          })).all();
          const readable = database.query(toSql(query, {
            dialect: "sqlite",
            format: "compact",
            renderStrategy: "readable",
          })).all();
          expect(optimized).toEqual(readable);
        } finally {
          database.close();
        }
      }
    ), { numRuns: 100 });
  });
});

function toSqlFromPortable(ir: Parameters<typeof validateQueryIR>[0]): string {
  validateQueryIR(ir);
  return irToSql(ir as never, { dialect: "sqlite", format: "compact" });
}

function asNonEmptyRows(rows: GeneratedRow[]): [GeneratedRow, ...GeneratedRow[]] {
  return rows as [GeneratedRow, ...GeneratedRow[]];
}
