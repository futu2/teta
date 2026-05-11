import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")) as T;

test("package metadata stays in sync across publish manifests", () => {
  const sqlPackage = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/sql/package.json");
  const sqlJsr = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/sql/jsr.json");

  expect(sqlPackage.name).toEqual(sqlJsr.name);
  expect(sqlPackage.version).toEqual(sqlJsr.version);
  expect(sqlPackage.exports).toEqual(sqlJsr.exports);

  const tetaPackage = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/teta/package.json");
  const tetaJsr = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/teta/jsr.json");

  expect(tetaPackage.name).toEqual(tetaJsr.name);
  expect(tetaPackage.version).toEqual(tetaJsr.version);
  expect(tetaPackage.exports).toEqual(tetaJsr.exports);

  const devPackage = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/dev/package.json");
  const devJsr = readJson<{
    name: string;
    version: string;
    exports: Record<string, string>;
  }>("packages/dev/jsr.json");
  const devDeno = readJson<{
    name: string;
    version: string;
    exports: string;
  }>("packages/dev/deno.json");

  expect(devPackage.name).toEqual(devJsr.name);
  expect(devPackage.version).toEqual(devJsr.version);
  expect(devPackage.exports).toEqual(devJsr.exports);
  expect(devPackage.name).toEqual(devDeno.name);
  expect(devPackage.version).toEqual(devDeno.version);
  expect(devPackage.exports["."]).toEqual(devDeno.exports);
});

test("teta jsr manifest maps workspace dependencies to jsr packages", () => {
  const tetaPackage = readJson<{
    dependencies?: Record<string, string>;
  }>("packages/teta/package.json");
  const tetaJsr = readJson<{
    imports?: Record<string, string>;
  }>("packages/teta/jsr.json");

  expect(tetaPackage.dependencies?.["@teta/sql"]).toEqual("workspace:*");
  expect(tetaJsr.imports?.["@teta/sql"]).toEqual("jsr:@teta/sql@^0.1.0");
});
