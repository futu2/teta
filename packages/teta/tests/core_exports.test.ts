import { describe, expect, test } from "bun:test";
import * as teta from "../mod.ts";

describe("core entrypoint boundary", () => {
  test("does not export dev helpers", () => {
    expect("copyTextToClipboard" in teta).toBe(false);
    expect("renderSqlFromSource" in teta).toBe(false);
    expect("watchQuerySourceToClipboard" in teta).toBe(false);
  });
});
