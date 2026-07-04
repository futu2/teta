import { describe, expect, test } from "bun:test";
import { resolveFreezeFlag } from "../src/edsl/runtime_config.ts";

describe("runtime config", () => {
  test("does not require env capability when resolving freeze flags", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "process");
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      value: {
        env: new Proxy({}, {
          get() {
            throw new Error("env access denied");
          },
        }),
      },
    });

    try {
      expect(resolveFreezeFlag("TETA_FREEZE_EXPR_VALUES")).toBe(true);
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "process", original);
      } else {
        delete (globalThis as { process?: unknown }).process;
      }
    }
  });
});
