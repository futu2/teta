import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TetaUserError } from "@teta/teta";

import {
  normalizeWatchPaths,
  resolveWatchQuerySourceOptions,
} from "../src/watch_shared.ts";

const createdDirs: string[] = [];

function uniqueSuffix(): string {
  return `?test=${Date.now()}-${Math.random()}`;
}

async function writeTempModule(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "teta-dev-watch-test-"));
  createdDirs.push(directory);
  const file = join(directory, "query.ts");
  await writeFile(file, contents, "utf8");
  return file;
}

afterEach(async () => {
  mock.restore();
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
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
    const file = await writeTempModule('export const query = "SELECT 1";');
    let resolveOnError!: () => void;
    const onErrorCalled = new Promise<void>((resolve) => {
      resolveOnError = resolve;
    });

    mock.module("@mariozechner/clipboard", () => {
      throw new Error("native load failed");
    });

    const { watchQuerySourceToClipboard } = await import(
      new URL(`../src/watch.ts${uniqueSuffix()}`, import.meta.url).href
    );

    const controller = await watchQuerySourceToClipboard({
      source: file,
      runImmediately: true,
      onError: (error: unknown) => {
        errors.push(error);
        resolveOnError();
      },
      log: (message: string) => logs.push(message),
    });

    await Promise.race([
      onErrorCalled,
      Bun.sleep(1000).then(() => {
        throw new Error("Timed out waiting for watch onError callback");
      }),
    ]);
    controller.stop();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TetaUserError);
    expect((errors[0] as TetaUserError).code).toBe("CLIPBOARD_TOOL_UNAVAILABLE");
    expect((errors[0] as TetaUserError).message).toContain("native load failed");
    expect(logs.some((message) => message.includes("copied SQL to clipboard"))).toBe(false);
  });
});
