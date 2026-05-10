import { describe, expect, test } from "bun:test";
import { $, $left, $right, ExprRef, eq, pickCols } from "../mod.ts";

describe("deferred row proxy api", () => {
  test("exports deferred row proxies that compose through expression helpers", () => {
    expect(eq($.id, 1)).toBeInstanceOf(ExprRef);
    expect(eq($left.id, $right.user_id)).toBeInstanceOf(ExprRef);
  });

  test("exports pickCols as a selector helper", () => {
    expect(typeof pickCols("id")).toBe("function");
  });
});
