import { expect, test } from "bun:test";
import * as publicApi from "../mod.ts";
import * as advancedApi from "../advanced.ts";
import * as queryApi from "../query.ts";

test("exports rename but not the other removed projection helpers", () => {
  expect(typeof publicApi.rename).toBe("function");
  expect(typeof queryApi.rename).toBe("function");

  for (const name of ["pick", "extend", "drop"]) {
    expect(name in publicApi).toBe(false);
    expect(name in queryApi).toBe(false);
  }
});

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

test("keeps compiler constructors and custom functions out of the default surface", () => {
  const rootOnlyInternals = [
    "exprOf",
    "columnOf",
    "toExprNode",
    "funcExpr",
    "windowExpr",
    "createColumnRefs",
    "fn",
    "windowFn",
  ];

  for (const name of rootOnlyInternals) {
    expect(name in publicApi).toBe(false);
  }
  expect(typeof advancedApi.fn).toBe("function");
  expect(typeof advancedApi.windowFn).toBe("function");
});

test("schema helpers use short names only", () => {
  expect(typeof publicApi.t.string).toBe("function");
  expect(typeof publicApi.t.boolean).toBe("function");
  expect(typeof publicApi.t.int).toBe("function");
  expect("sqlString" in publicApi.t).toBe(false);
  expect("sqlBoolean" in publicApi.t).toBe(false);
  expect("sqlInt" in publicApi.t).toBe(false);
});

test("cast helpers use as-prefix names only", () => {
  expect(typeof publicApi.asInt).toBe("function");
  expect(typeof publicApi.asDate).toBe("function");
  expect("toInt" in publicApi).toBe(false);
  expect("toFloat" in publicApi).toBe(false);
  expect("toString" in publicApi).toBe(false);
  expect("toDate" in publicApi).toBe(false);
  expect("toTimestamp" in publicApi).toBe(false);
});
