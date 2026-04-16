import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import ts from "typescript";

const MOD_PATH = fileURLToPath(new URL("../mod.ts", import.meta.url));
const JOIN_HELPERS_PATH = fileURLToPath(new URL("../src/edsl/query/join.ts", import.meta.url));

function getModSourceFile(): ts.SourceFile {
  const program = ts.createProgram({
    rootNames: [MOD_PATH],
    options: {
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
    },
  });

  const sourceFile = program.getSourceFile(MOD_PATH);
  if (!sourceFile) {
    throw new Error("Could not load mod.ts");
  }
  return sourceFile;
}

function getSourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
}

describe("public entrypoint typings", () => {
  test("all exported const declarations in mod.ts have explicit type annotations", () => {
    const sourceFile = getModSourceFile();
    const missingTypes: string[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!isExported) continue;

      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        if (!declaration.type) {
          missingTypes.push(declaration.name.text);
        }
      }
    }

    expect(missingTypes).toEqual([]);
  });

  test("exported join helper functions have explicit return types or overloads", () => {
    const sourceFile = getSourceFile(JOIN_HELPERS_PATH);
    const overloadedFunctions = new Set(
      sourceFile.statements.flatMap((statement) => {
        if (!ts.isFunctionDeclaration(statement)) return [];
        if (statement.body) return [];
        if (!statement.name || !statement.type) return [];
        const isExported = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        );
        return isExported ? [statement.name.text] : [];
      })
    );
    const missingTypes: string[] = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isFunctionDeclaration(statement)) continue;
      if (!statement.body || !statement.name) continue;
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!isExported) continue;
      if (statement.type || overloadedFunctions.has(statement.name.text)) continue;
      missingTypes.push(statement.name.text);
    }

    expect(missingTypes).toEqual([]);
  });
});
