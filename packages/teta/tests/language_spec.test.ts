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
      inputs: ["string"],
      variadic: null,
      result: "string",
      nullability: "propagate",
    });
    expect(BUILTIN_FUNCTION_SPECS.COALESCE.nullability).toBe("coalesce");
    expect(BUILTIN_FUNCTION_SPECS.GREATEST).toMatchObject({
      arity: { min: 2, max: null },
      inputs: ["numeric", "numeric"],
      variadic: "numeric",
    });
    expect(Object.isFrozen(BUILTIN_FUNCTION_SPECS.GREATEST)).toBe(true);
    expect(Object.isFrozen(BUILTIN_FUNCTION_SPECS.GREATEST.inputs)).toBe(true);
  });
});
