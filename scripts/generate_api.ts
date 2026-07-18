import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const MAX_STEPS = 12;
const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
const check = process.argv.includes("--check");
let stale = false;

generateRegions("packages/teta/src/edsl/pipe.ts", {
  "pipe-overloads": generateUnaryOverloads("pipe", true),
  "flow-overloads": generateUnaryOverloads("flow", false),
});
generateRegions("packages/teta/src/edsl/query/steps.ts", {
  "compose-overloads": generateComposeOverloads(),
});

const manifestPath = "packages/teta/api-manifest.json";
const manifest = `${JSON.stringify({
  generatedBy: "scripts/generate_api.ts",
  values: collectPublicValues("packages/teta/mod.ts"),
}, null, 2)}\n`;
let oldManifest = "";
try {
  oldManifest = readFileSync(repositoryPath(manifestPath), "utf8");
} catch {
  // Initial generation creates the manifest.
}
checkOrWrite(manifestPath, oldManifest, manifest);

if (check && stale) process.exitCode = 1;

function generateUnaryOverloads(name: "pipe" | "flow", withValue: boolean): string {
  const output = [
    withValue
      ? "export function pipe<TValue>(value: TValue): TValue;"
      : "export function flow<TValue>(): UnaryStep<TValue, TValue>;",
  ];
  for (let count = 1; count <= MAX_STEPS; count += 1) {
    const generics = ["TValue", ...range(count).map((n) => `T${n}`)].join(", ");
    const parameters = [
      ...(withValue ? ["value: TValue"] : []),
      ...range(count).map((n) =>
        `step${n}: UnaryStep<${n === 1 ? "TValue" : `T${n - 1}`}, T${n}>`),
    ];
    output.push(
      `export function ${name}<${generics}>(\n${indent(parameters.join(",\n"))}\n): ${
        withValue ? `T${count}` : `UnaryStep<TValue, T${count}>`
      };`
    );
  }

  const generics = [
    "TValue",
    ...range(MAX_STEPS).map((n) => `T${n}`),
    "const TRest extends readonly AnyUnaryStep[]",
  ];
  const parameters = [
    ...(withValue ? ["value: TValue"] : []),
    ...range(MAX_STEPS).map((n) =>
      `step${n}: UnaryStep<${n === 1 ? "TValue" : `T${n - 1}`}, T${n}>`),
    `...steps: TRest & PipeTail<T${MAX_STEPS}, TRest>`,
  ];
  const result = withValue
    ? `PipeTailResult<T${MAX_STEPS}, TRest>`
    : `UnaryStep<TValue, PipeTailResult<T${MAX_STEPS}, TRest>>`;
  output.push(
    `export function ${name}<\n${indent(generics.join(",\n"))},\n>(\n${indent(parameters.join(",\n"))}\n): ${result};`
  );
  return output.join("\n");
}

function generateComposeOverloads(): string {
  const output = [
    "export function composeSteps(): IdentityQueryStep;",
    "export function composeSteps<TInput extends QueryColumns, T1 extends QueryColumns>(\n  step1: QueryStep<TInput, T1>\n): QueryStep<TInput, T1>;",
  ];
  for (let count = 1; count <= MAX_STEPS; count += 1) {
    const generics = [
      "TInput extends QueryColumns",
      ...range(count).map((n) => `T${n} extends QueryColumns`),
    ];
    const parameters = range(count).map((n) =>
      `step${n}: QueryTransform<${n === 1 ? "TInput" : `T${n - 1}`}, T${n}>`);
    output.push(
      `export function composeSteps<\n${indent(generics.join(",\n"))},\n>(\n${indent(parameters.join(",\n"))}\n): QueryStep<TInput, T${count}>;`
    );
  }

  const generics = [
    "TInput extends QueryColumns",
    ...range(MAX_STEPS).map((n) => `T${n} extends QueryColumns`),
    "const TRest extends readonly AnyQueryTransform[]",
  ];
  const parameters = [
    ...range(MAX_STEPS).map((n) =>
      `step${n}: QueryTransform<${n === 1 ? "TInput" : `T${n - 1}`}, T${n}>`),
    `...steps: TRest & QueryStepTail<T${MAX_STEPS}, TRest>`,
  ];
  output.push(
    `export function composeSteps<\n${indent(generics.join(",\n"))},\n>(\n${indent(parameters.join(",\n"))}\n): QueryStep<TInput, QueryStepTailResult<T${MAX_STEPS}, TRest>>;`
  );
  return output.join("\n");
}

function generateRegions(path: string, regions: Record<string, string>): void {
  const oldSource = readFileSync(repositoryPath(path), "utf8");
  let source = oldSource;
  for (const [name, content] of Object.entries(regions)) {
    source = replaceRegion(source, name, content);
  }
  checkOrWrite(path, oldSource, source);
}

function collectPublicValues(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(repositoryPath(path), "utf8"), ts.ScriptTarget.Latest, true);
  const values = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) values.add(declaration.name.text);
      }
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) values.add(element.name.text);
      }
    }
  }
  return [...values].sort();
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function replaceRegion(source: string, name: string, content: string): string {
  const start = `// <generated:${name}>`;
  const end = `// </generated:${name}>`;
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex < 0 || endIndex < startIndex) throw new Error(`Missing generated region: ${name}`);
  return `${source.slice(0, startIndex + start.length)}\n${content}\n${source.slice(endIndex)}`;
}

function checkOrWrite(path: string, oldValue: string, newValue: string): void {
  if (oldValue === newValue) return;
  if (check) {
    console.error(`Generated file is stale: ${path}`);
    stale = true;
    return;
  }
  writeFileSync(repositoryPath(path), newValue);
}

function repositoryPath(path: string): string {
  return resolve(REPOSITORY_ROOT, path);
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index + 1);
}

function indent(value: string): string {
  return value.split("\n").map((line) => `  ${line}`).join("\n");
}
