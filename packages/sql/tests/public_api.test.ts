import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  test("documents most exported symbols for JSR", () => {
    const program = ts.createProgram({
      rootNames: [MOD_PATH],
      options: {
        allowImportingTsExtensions: true,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
      },
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(MOD_PATH);
    if (!sourceFile) {
      throw new Error("Could not load sql mod.ts");
    }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      throw new Error("Could not inspect sql module symbol");
    }

    const exported = checker.getExportsOfModule(moduleSymbol);
    const documented = exported.filter((symbol) => {
      const declarations = symbol.getDeclarations() ?? [];
      return declarations.some((declaration) => {
        const comments = ts.getJSDocCommentsAndTags(declaration);
        return comments.length > 0;
      });
    });

    expect(documented.length / exported.length).toBeGreaterThanOrEqual(0.8);
  });

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
