import { describe, expect, test } from "bun:test";

import { copyTextToClipboardWithWriter } from "../src/clipboard.ts";

describe("clipboard integration", () => {
  test("returns native when the adapter succeeds", async () => {
    const writes: string[] = [];

    await expect(
      copyTextToClipboardWithWriter("SELECT 1", "auto", async (text) => {
        writes.push(text);
      })
    ).resolves.toBe("native");

    expect(writes).toEqual(["SELECT 1"]);
  });

  test("wraps adapter failures in a Teta user error", async () => {
    await expect(
      copyTextToClipboardWithWriter("SELECT 1", "auto", async () => {
        throw new Error("clipboard unavailable");
      })
    ).rejects.toThrow("Unable to copy SQL to clipboard");
  });

  test("returns a promise when using the injected writer path", () => {
    const promise = copyTextToClipboardWithWriter("SELECT 1", "auto", async () => {});
    expect(promise).toBeInstanceOf(Promise);
  });
});
