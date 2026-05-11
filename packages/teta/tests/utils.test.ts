import { describe, expect, test } from "bun:test";

import {
  UNSUPPORTED_CROSS_JOIN_ERROR,
} from "./helpers/expected-errors.ts";
import { normalizeJoinType } from "../src/edsl/query/utils.ts";
import { suggestCanonicalBuiltin } from "@teta/sql";

describe("query helpers", () => {
  test("normalizes supported join types", () => {
    expect(normalizeJoinType("left")).toBe("LEFT");
    expect(normalizeJoinType("inner")).toBe("INNER");
    expect(() => normalizeJoinType("cross")).toThrow(
      UNSUPPORTED_CROSS_JOIN_ERROR
    );
  });

  test("suggests canonical builtin dialect names", () => {
    expect(suggestCanonicalBuiltin("HetuEngine DQL")).toBe("hetu");
    expect(suggestCanonicalBuiltin("postgresql")).toBe("postgresql");
    expect(suggestCanonicalBuiltin("unknown dialect")).toBeNull();
  });
});
