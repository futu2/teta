import { describe, expect, test } from "bun:test";

import {
  BUILTIN_DIALECTS,
  formatDialectCapabilityMatrixMarkdown,
  getDialectCapabilities,
  getDialectCapabilityMatrix,
  getLanguageOperations,
} from "../mod.ts";

describe("dialect capability matrix", () => {
  test("covers every catalog operation for every registered built-in dialect", () => {
    const operations = getLanguageOperations();
    const matrix = getDialectCapabilityMatrix();

    for (const dialect of Object.keys(BUILTIN_DIALECTS)) {
      const capabilities = matrix[dialect as keyof typeof matrix];
      expect(Object.keys(capabilities).sort()).toEqual([...operations].sort());
      for (const operation of operations) {
        expect(["native", "rewritten", "emulated", "unsupported"])
          .toContain(capabilities[operation]);
      }
    }
  });

  test("derives mapped functions, fallbacks, and feature lowerings from dialect configuration", () => {
    expect(getDialectCapabilities("sqlite").BIT_LENGTH).toBe("emulated");
    expect(getDialectCapabilities("sqlite").CHAR_LENGTH).toBe("rewritten");
    expect(getDialectCapabilities("sqlite").LATERAL_JOIN).toBe("rewritten");
    expect(getDialectCapabilities("trino").ARRAY_LENGTH).toBe("rewritten");
    expect(getDialectCapabilities("postgresql").RECURSIVE_CTE).toBe("native");
  });

  test("normalizes partial dialect-shaped values instead of trusting them as resolved", () => {
    const partialDialect = {
      name: "custom",
      parserDialect: null,
      features: {},
      language: {},
    };

    expect(getDialectCapabilities(partialDialect as never).ABS).toBe("native");
  });

  test("formats generated documentation from the same matrix", () => {
    const markdown = formatDialectCapabilityMatrixMarkdown();
    expect(markdown).toContain("| Operation | mysql | mariadb |");
    expect(markdown).toContain("| BIT_LENGTH | ");
    expect(markdown).toContain("| RECURSIVE_CTE | ");
  });
});
