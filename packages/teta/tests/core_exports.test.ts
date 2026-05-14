import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import * as teta from "../mod.ts";

const modPath = fileURLToPath(new URL("../mod.ts", import.meta.url));
const coreExprPath = fileURLToPath(new URL("../src/edsl/core/expr.ts", import.meta.url));
const exprPath = fileURLToPath(new URL("../src/edsl/expr.ts", import.meta.url));

describe("core entrypoint boundary", () => {
  test("does not export dev helpers", () => {
    expect("copyTextToClipboard" in teta).toBe(false);
    expect("renderSqlFromSource" in teta).toBe(false);
    expect("watchQuerySourceToClipboard" in teta).toBe(false);
  });

  test("does not export proxy or deferred shorthand column refs", () => {
    expect("$" in teta).toBe(false);
    expect("$left" in teta).toBe(false);
    expect("$right" in teta).toBe(false);
    expect("col" in teta).toBe(false);
    expect("leftCol" in teta).toBe(false);
    expect("rightCol" in teta).toBe(false);
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

  test("core expression barrels do not export deferred internals", async () => {
    const coreExprSource = await readFile(coreExprPath, "utf8");
    const exprSource = await readFile(exprPath, "utf8");
    const bannedCoreExports = [
      "DeferredExprDeps",
      "DeferredExprDepsForArgs",
      "DeferredExprDepsOf",
      "DeferredExprDepScope",
      "EmptyDeferredExprDeps",
    ];

    for (const name of bannedCoreExports) {
      expect(coreExprSource.includes(`type ${name}`)).toBe(false);
    }

    expect(coreExprSource.includes("./expr/deferred.ts")).toBe(false);
    expect(exprSource.includes("./core/expr/deferred.ts")).toBe(false);
  });
});
