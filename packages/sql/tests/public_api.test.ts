import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as sql from "../mod.ts";

const MOD_PATH = fileURLToPath(new URL("../mod.ts", import.meta.url));
const SQL_ROOT = fileURLToPath(new URL("..", import.meta.url));

function collectSqlSourcePaths(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectSqlSourcePaths(path);
    }
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

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

  test("exports shared error classes", () => {
    expect(typeof sql.TetaError).toBe("function");
    expect(typeof sql.TetaUserError).toBe("function");
    expect(typeof sql.TetaInternalError).toBe("function");
  });

  test("validateQueryIR rejects non-IR values", () => {
    expect(() => sql.validateQueryIR(null)).toThrow(sql.TetaUserError);
    expect(() => sql.ir.validateQueryIR(null)).toThrow(sql.TetaUserError);
  });

  test("public backend sources do not import the frontend package", () => {
    const srcPath = `${SQL_ROOT}/src`;
    const sourcePaths = [
      MOD_PATH,
      ...(statSync(srcPath, { throwIfNoEntry: false })?.isDirectory()
        ? collectSqlSourcePaths(srcPath)
        : []),
    ];
    const forbiddenImports = [
      `@teta/${"teta"}`,
      `../${"teta"}`,
      `../../${"teta"}`,
      `packages/${"teta"}`,
    ];

    for (const path of sourcePaths) {
      const source = readFileSync(path, "utf8");
      for (const forbiddenImport of forbiddenImports) {
        expect(source.includes(forbiddenImport)).toBe(false);
      }
    }
  });
});
