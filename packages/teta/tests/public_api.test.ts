import { expect, test } from "bun:test";
import * as publicApi from "../mod.ts";

test("does not export public constructor values", () => {
  const removedExprRefExport = "Expr" + "Ref";

  expect("Query" in publicApi).toBe(false);
  expect(removedExprRefExport in publicApi).toBe(false);
  expect(typeof publicApi.isQuery).toBe("function");
  expect(typeof publicApi.isExpr).toBe("function");
  expect(typeof publicApi.isColumn).toBe("function");
});
