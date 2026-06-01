import { expect, test } from "bun:test";
import * as publicApi from "../mod.ts";

test("does not export public constructor values", () => {
  const removedExprRefExport = "Expr" + "Ref";

  expect("Query" in publicApi).toBe(false);
  expect(removedExprRefExport in publicApi).toBe(false);
  expect("select" in publicApi).toBe(false);
  expect("alias" in publicApi).toBe(false);
  expect(typeof publicApi.isQuery).toBe("function");
  expect(typeof publicApi.isExpr).toBe("function");
  expect(typeof publicApi.isColumn).toBe("function");
});

test("schema helpers use short names only", () => {
  expect(typeof publicApi.t.string).toBe("function");
  expect(typeof publicApi.t.boolean).toBe("function");
  expect(typeof publicApi.t.int).toBe("function");
  expect("sqlString" in publicApi.t).toBe(false);
  expect("sqlBoolean" in publicApi.t).toBe(false);
  expect("sqlInt" in publicApi.t).toBe(false);
});
