import { describe, expect, test } from "bun:test";

import {
  UNSUPPORTED_CROSS_JOIN_ERROR,
} from "./helpers/expected-errors.ts";
import { normalizeIdentifier, normalizeJoinType, normalizeTableSource } from "../src/edsl/query/utils.ts";
import { suggestCanonicalBuiltin } from "../src/edsl/sql/dialect/lookup.ts";

describe("query helpers", () => {
  test("normalizes structured table sources", () => {
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

  test("auto-quotes invalid identifiers", () => {
    expect(normalizeIdentifier("events")).toEqual({
      name: "events",
      quoted: false,
    });
    expect(normalizeIdentifier("events log")).toEqual({
      name: "events log",
      quoted: true,
    });
    expect(normalizeTableSource({ table: "events log", schema: "analytics data", as: "event source" })).toEqual({
      db: null,
      schema: { name: "analytics data", quoted: true },
      table: { name: "events log", quoted: true },
      as: { name: "event source", quoted: true },
    });
  });

  test("rejects empty structured source parts", () => {
    expect(() => normalizeTableSource({ table: "   " })).toThrow(
      "table source table must be non-empty"
    );
  });

  test("normalizes supported join types", () => {
    expect(normalizeJoinType("left")).toBe("LEFT");
    expect(normalizeJoinType("inner")).toBe("INNER");
    expect(() => normalizeJoinType("cross" as never)).toThrow(
      UNSUPPORTED_CROSS_JOIN_ERROR
    );
  });

  test("suggests canonical builtin dialect names", () => {
    expect(suggestCanonicalBuiltin("HetuEngine DQL")).toBe("hetu");
    expect(suggestCanonicalBuiltin("postgresql")).toBe("postgresql");
    expect(suggestCanonicalBuiltin("unknown dialect")).toBeNull();
  });
});
