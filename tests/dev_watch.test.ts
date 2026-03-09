import { describe, expect, test } from "bun:test";

import {
  normalizeWatchPaths,
  resolveWatchQuerySourceOptions,
} from "../src/edsl/dev/watch_shared.ts";

describe("watch dev helpers", () => {
  test("normalizeWatchPaths falls back to source for blank values", () => {
    expect(normalizeWatchPaths("queries/user.ts")).toEqual(["queries/user.ts"]);
    expect(normalizeWatchPaths("queries/user.ts", "   ")).toEqual(["queries/user.ts"]);
    expect(normalizeWatchPaths("queries/user.ts", ["  ", "src/queries"])).toEqual([
      "src/queries",
    ]);
  });

  test("resolveWatchQuerySourceOptions applies defaults", () => {
    const options = resolveWatchQuerySourceOptions({
      source: " queries/user.ts ",
    });

    expect(options.source).toBe("queries/user.ts");
    expect(options.exportName).toBe("query");
    expect(options.watchPaths).toEqual(["queries/user.ts"]);
    expect(options.isolateModules).toBe(true);
    expect(options.shouldCopy).toBe(true);
    expect(options.runImmediately).toBe(true);
    expect(options.debounceMs).toBe(120);
  });
});
