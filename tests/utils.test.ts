import { describe, expect, test } from "bun:test";

import {
  UNSUPPORTED_CROSS_JOIN_ERROR,
} from "./helpers/expected-errors.ts";
import { normalizeJoinType, parseTableName } from "../src/edsl/query/utils.ts";
import { suggestCanonicalBuiltin } from "../src/edsl/sql/dialect/lookup.ts";

describe("query helpers", () => {
  test("parses schema-qualified table names", () => {
    expect(parseTableName("analytics.events")).toEqual({
      schema: "analytics",
      table: "events",
    });
    expect(parseTableName("events")).toEqual({
      schema: null,
      table: "events",
    });
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
