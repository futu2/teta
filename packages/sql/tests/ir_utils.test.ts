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
    expect(normalizeIdentifier("user id", "column")).toEqual({
      name: "user id",
      quoted: true,
    });
  });

  test("normalizes table sources", () => {
    expect(normalizeTableSource("analytics.events")).toEqual({
      db: null,
      schema: { name: "analytics", quoted: false },
      table: { name: "events", quoted: false },
      as: null,
    });
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
