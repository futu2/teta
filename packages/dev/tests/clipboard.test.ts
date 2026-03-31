import { afterEach, describe, expect, mock, test } from "bun:test";
import { TetaUserError } from "@teta/teta";

function uniqueSuffix(): string {
  return `?test=${Date.now()}-${Math.random()}`;
}

async function importClipboardModule() {
  return import(new URL(`../src/clipboard.ts${uniqueSuffix()}`, import.meta.url).href);
}

async function importDevModule() {
  return import(new URL(`../mod.ts${uniqueSuffix()}`, import.meta.url).href);
}

afterEach(() => {
  mock.restore();
});

describe("clipboard integration", () => {
  test("returns native when the adapter succeeds", async () => {
    const { copyTextToClipboardWithWriter } = await importClipboardModule();
    const writes: string[] = [];

    await expect(
      copyTextToClipboardWithWriter("SELECT 1", "auto", async (text: string) => {
        writes.push(text);
      })
    ).resolves.toBe("native");

    expect(writes).toEqual(["SELECT 1"]);
  });

  test("wraps adapter failures in a Teta user error", async () => {
    const { copyTextToClipboardWithWriter } = await importClipboardModule();

    try {
      await copyTextToClipboardWithWriter("SELECT 1", "auto", async () => {
        throw new Error("clipboard unavailable");
      });
      throw new Error("Expected copyTextToClipboardWithWriter() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("CLIPBOARD_TOOL_UNAVAILABLE");
      expect((error as TetaUserError).message).toContain("Unable to copy SQL to clipboard");
      expect((error as TetaUserError).message).toContain("clipboard unavailable");
    }
  });

  test("returns a promise when using the injected writer path", async () => {
    const { copyTextToClipboardWithWriter } = await importClipboardModule();
    const promise = copyTextToClipboardWithWriter("SELECT 1", "auto", async () => {});
    expect(promise).toBeInstanceOf(Promise);
  });

  test("imports the dev module even when the clipboard package fails to load", async () => {
    mock.module("@mariozechner/clipboard", () => {
      throw new Error("native load failed");
    });

    await expect(importDevModule()).resolves.toBeDefined();
  });

  test("copyTextToClipboard wraps clipboard package load failures", async () => {
    mock.module("@mariozechner/clipboard", () => {
      throw new Error("native load failed");
    });

    try {
      const { copyTextToClipboard } = await importClipboardModule();
      await copyTextToClipboard("SELECT 1", "auto");
      throw new Error("Expected copyTextToClipboard() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("CLIPBOARD_TOOL_UNAVAILABLE");
      expect((error as TetaUserError).message).toContain("Unable to copy SQL to clipboard");
      expect((error as TetaUserError).message).toContain("native load failed");
    }
  });
});
