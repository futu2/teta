import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as sql from "../mod.ts";

const MOD_PATH = fileURLToPath(new URL("../mod.ts", import.meta.url));

describe("sql backend public api", () => {
  test("exports backend rendering entrypoints", () => {
    expect(typeof sql.irToSql).toBe("function");
    expect(typeof sql.irToSqlResult).toBe("function");
    expect(typeof sql.irToAst).toBe("function");
    expect(typeof sql.exprToSql).toBe("function");
    expect(typeof sql.exprToSqlResult).toBe("function");
    expect(typeof sql.explainIR).toBe("function");
  });

  test("exports the ir helper namespace", () => {
    expect(typeof sql.ir).toBe("object");
    expect(typeof sql.ir.validateQueryIR).toBe("function");
  });

  test("public backend entrypoint does not import the frontend package", () => {
    const source = readFileSync(MOD_PATH, "utf8");
    expect(source.includes("@teta/teta")).toBe(false);
    expect(source.includes("../teta")).toBe(false);
  });
});
