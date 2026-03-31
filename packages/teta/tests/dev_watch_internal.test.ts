import { describe, expect, test } from "bun:test";

import { TetaUserError } from "../mod.ts";
import { resolveWatchQuerySourceOptions } from "../src/edsl/dev/watch_shared.ts";

describe("watch source option validation", () => {
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
