import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import ts from "typescript";

const MOD_PATH = fileURLToPath(new URL("../mod.ts", import.meta.url));
const JOIN_HELPERS_PATH = fileURLToPath(new URL("../src/edsl/helpers/join_merge.ts", import.meta.url));
const TETA_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TSCONFIG_PATH = fileURLToPath(new URL("../tsconfig.json", import.meta.url));

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

  test("projection key helpers suggest columns from the preceding pipe query", () => {
    const virtualPath = fileURLToPath(new URL("./__projection_completion__.ts", import.meta.url));
    const source = [
      'import { drop, pipe, pick, table, t } from "../mod.ts";',
      'const users = table("users", { id: t.int(), name: t.string(), active: t.boolean() });',
      'const firstPick = pipe(users, pick(""));',
      'const nextPick = pipe(users, pick("id", ""));',
      'const firstDrop = pipe(users, drop(""));',
      'const nextDrop = pipe(users, drop("id", ""));',
      'const chainedDrop = pipe(users, pick("id", "name"), drop(""));',
    ].join("\n");
    const configFile = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
    }
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, TETA_ROOT);
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [...config.fileNames, virtualPath],
      getScriptVersion: () => "0",
      getScriptSnapshot: (path) => {
        const contents = path === virtualPath ? source : ts.sys.readFile(path);
        return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents);
      },
      getCurrentDirectory: () => TETA_ROOT,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };
    const service = ts.createLanguageService(host);
    const firstCompletionPosition = source.indexOf('pick("")') + 'pick("'.length;
    const nextCompletionPosition = source.indexOf('pick("id", "")') + 'pick("id", "'.length;
    const firstDropCompletionPosition = source.indexOf('drop("")') + 'drop("'.length;
    const nextDropCompletionPosition = source.indexOf('drop("id", "")') + 'drop("id", "'.length;
    const chainedDropMarker = 'pick("id", "name"), drop("")';
    const chainedDropCompletionPosition = source.indexOf(chainedDropMarker) + chainedDropMarker.length - 2;
    const completionOptions = {
      includeCompletionsForModuleExports: false,
    };
    const firstCompletionNames = service
      .getCompletionsAtPosition(virtualPath, firstCompletionPosition, completionOptions)
      ?.entries.map((entry) => entry.name);
    const nextCompletionNames = service
      .getCompletionsAtPosition(virtualPath, nextCompletionPosition, completionOptions)
      ?.entries.map((entry) => entry.name);
    const firstDropCompletionNames = service
      .getCompletionsAtPosition(virtualPath, firstDropCompletionPosition, completionOptions)
      ?.entries.map((entry) => entry.name);
    const nextDropCompletionNames = service
      .getCompletionsAtPosition(virtualPath, nextDropCompletionPosition, completionOptions)
      ?.entries.map((entry) => entry.name);
    const chainedDropCompletionNames = service
      .getCompletionsAtPosition(virtualPath, chainedDropCompletionPosition, completionOptions)
      ?.entries.map((entry) => entry.name);
    service.dispose();

    expect(firstCompletionNames).toEqual(["id", "name", "active"]);
    expect(nextCompletionNames).toEqual(["id", "name", "active"]);
    expect(firstDropCompletionNames).toEqual(["id", "name", "active"]);
    expect(nextDropCompletionNames).toEqual(["id", "name", "active"]);
    expect(chainedDropCompletionNames).toEqual(["id", "name"]);
  });
});
