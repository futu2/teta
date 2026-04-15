import { describe, expect, test } from "bun:test";
import { getLanguageSpec } from "../mod.ts";

describe("language spec exports", () => {
  test("includes ARRAY_AGG in the aggregate category", () => {
    expect(getLanguageSpec().windowAndAgg).toContain("ARRAY_AGG");
  });
});
