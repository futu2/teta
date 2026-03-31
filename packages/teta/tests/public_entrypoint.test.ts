import { describe, expect, test } from "bun:test";
import ts from "typescript";

function getModSourceFile(): ts.SourceFile {
  const program = ts.createProgram({
    rootNames: ["mod.ts"],
    options: {
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
    },
  });

  const sourceFile = program.getSourceFile("mod.ts");
  if (!sourceFile) {
    throw new Error("Could not load mod.ts");
  }
  return sourceFile;
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
});
