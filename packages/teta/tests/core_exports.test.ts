import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import * as teta from "../mod.ts";

const modPath = fileURLToPath(new URL("../mod.ts", import.meta.url));

describe("core entrypoint boundary", () => {
  test("does not export dev helpers", () => {
    expect("copyTextToClipboard" in teta).toBe(false);
    expect("renderSqlFromSource" in teta).toBe(false);
    expect("watchQuerySourceToClipboard" in teta).toBe(false);
  });

  test("mod.ts source does not export dev helpers or dev-only types", async () => {
    const source = await readFile(modPath, "utf8");
    const bannedExports = [
      "copyTextToClipboard",
      "renderSqlFromSource",
      "watchQuerySourceToClipboard",
      "ClipboardTool",
      "QueryLike",
      "WatchQueryController",
      "WatchQuerySourceOptions",
    ];

    for (const name of bannedExports) {
      const exportPattern = new RegExp(
        `\\bexport\\s+(?:const|type)\\s+${name}\\b`,
        "m"
      );
      expect(exportPattern.test(source)).toBe(false);
    }

    expect(source.includes("development utilities")).toBe(false);
  });
});
