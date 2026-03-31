import { afterEach, describe, expect, mock, test } from "bun:test";
import { TetaUserError } from "@teta/teta";

import {
  normalizeWatchPaths,
  resolveWatchQuerySourceOptions,
} from "../src/watch_shared.ts";

function uniqueSuffix(): string {
  return `?test=${Date.now()}-${Math.random()}`;
}

afterEach(() => {
  mock.restore();
});

describe("watch option normalization", () => {
  test("applies the source path when watchPaths is blank", () => {
    expect(resolveWatchQuerySourceOptions({ source: " queries/user.ts " }).watchPaths).toEqual([
      "queries/user.ts",
    ]);
  });

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

  test("rejects blank source paths with a user error", () => {
    try {
      resolveWatchQuerySourceOptions({ source: "   " });
      throw new Error("Expected resolveWatchQuerySourceOptions() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("INVALID_TABLE_SOURCE");
      expect((error as TetaUserError).message).toBe(
        "watchQuerySourceToClipboard requires a non-empty source path"
      );
    }
  });
});

describe("watch clipboard flow", () => {
  test("routes clipboard load failures to onError during queued runs", async () => {
    const errors: unknown[] = [];
    const logs: string[] = [];
    const renderSourceSpecifier = new URL("../src/render_source.ts", import.meta.url).href;

    mock.module("@mariozechner/clipboard", () => {
      throw new Error("native load failed");
    });
    mock.module("node:fs", () => ({
      watch: () => ({
        close: () => {},
      }),
    }));
    mock.module(renderSourceSpecifier, () => ({
      renderSqlFromSource: async () => "SELECT 1",
      renderSqlFromSourceIsolated: () => "SELECT 1",
    }));

    const { watchQuerySourceToClipboard } = await import(
      new URL(`../src/watch.ts${uniqueSuffix()}`, import.meta.url).href
    );

    const controller = await watchQuerySourceToClipboard({
      source: "queries/user.ts",
      runImmediately: true,
      onError: (error: unknown) => errors.push(error),
      log: (message: string) => logs.push(message),
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.stop();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TetaUserError);
    expect((errors[0] as TetaUserError).code).toBe("CLIPBOARD_TOOL_UNAVAILABLE");
    expect((errors[0] as TetaUserError).message).toContain("native load failed");
    expect(logs.some((message) => message.includes("copied SQL to clipboard"))).toBe(false);
  });
});
