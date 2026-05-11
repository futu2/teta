import { describe, expect, test } from "bun:test";
import {
  columnNamesToIdentifierMap,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  shouldQuoteIdentifierName,
} from "../mod.ts";

describe("sql ir utilities", () => {
  test("normalizes identifiers and quotes invalid names", () => {
    expect(shouldQuoteIdentifierName("user_id")).toBe(false);
    expect(shouldQuoteIdentifierName("user id")).toBe(true);
    expect(normalizeIdentifier("events")).toEqual({
      name: "events",
      quoted: false,
    });
    expect(normalizeIdentifier("user id", "column")).toEqual({
      name: "user id",
      quoted: true,
    });
  });

  test("normalizes table sources", () => {
    expect(normalizeTableSource("events")).toEqual({
      db: null,
      schema: null,
      table: { name: "events", quoted: false },
      as: null,
    });
    expect(normalizeTableSource("analytics.events")).toEqual({
      db: null,
      schema: { name: "analytics", quoted: false },
      table: { name: "events", quoted: false },
      as: null,
    });
    expect(normalizeTableSource({ table: "events", schema: "analytics" })).toEqual({
      db: null,
      schema: { name: "analytics", quoted: false },
      table: { name: "events", quoted: false },
      as: null,
    });
    expect(normalizeTableSource({ path: ["warehouse", "analytics", "events"] })).toEqual({
      db: { name: "warehouse", quoted: false },
      schema: { name: "analytics", quoted: false },
      table: { name: "events", quoted: false },
      as: null,
    });
  });

  test("auto-quotes invalid table source identifiers", () => {
    expect(normalizeTableSource({ table: "events log", schema: "analytics data", as: "event source" })).toEqual({
      db: null,
      schema: { name: "analytics data", quoted: true },
      table: { name: "events log", quoted: true },
      as: { name: "event source", quoted: true },
    });
  });

  test("preserves caller-supplied quoted table source identifiers", () => {
    expect(normalizeTableSource({
      db: { name: "warehouse", quoted: true },
      schema: { name: "analytics", quoted: true },
      table: { name: "events", quoted: true },
      as: { name: "e", quoted: true },
    })).toEqual({
      db: { name: "warehouse", quoted: true },
      schema: { name: "analytics", quoted: true },
      table: { name: "events", quoted: true },
      as: { name: "e", quoted: true },
    });

    expect(normalizeTableSource({
      path: [
        { name: "warehouse", quoted: true },
        { name: "analytics", quoted: true },
        { name: "events", quoted: true },
      ],
      as: { name: "e", quoted: true },
    })).toEqual({
      db: { name: "warehouse", quoted: true },
      schema: { name: "analytics", quoted: true },
      table: { name: "events", quoted: true },
      as: { name: "e", quoted: true },
    });
  });

  test("rejects empty structured source parts", () => {
    expect(() => normalizeTableSource({ table: "   " })).toThrow(
      "table source table must be non-empty"
    );
  });

  test("normalizes join types", () => {
    expect(normalizeJoinType("left")).toBe("LEFT");
    expect(() => normalizeJoinType("semi")).toThrow();
  });

  test("builds identifier maps from column names", () => {
    expect(columnNamesToIdentifierMap(["id"])).toEqual({
      id: { name: "id", quoted: false },
    });
  });
});
