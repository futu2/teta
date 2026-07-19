import { describe, expect, test } from "bun:test";
import {
  BUILTIN_FUNCTION_SPECS,
  getLanguageSpec,
} from "../mod.ts";

describe("language spec exports", () => {
  test("includes ARRAY_AGG in the aggregate category", () => {
    expect(getLanguageSpec().windowAndAgg).toContain("ARRAY_AGG");
  });

  test("exposes shared scalar operation metadata", () => {
    expect(BUILTIN_FUNCTION_SPECS.UPPER).toEqual({
      arity: { min: 1, max: 1 },
      result: "string",
      nullability: "propagate",
    });
    expect(BUILTIN_FUNCTION_SPECS.COALESCE.nullability).toBe("never");
  });
});
