import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyTextToClipboard,
  renderSqlFromSource,
  watchQuerySourceToClipboard,
} from "../mod.ts";
import { missingQueryExportError } from "./helpers/expected-errors.ts";

const createdDirs: string[] = [];
const modPath = fileURLToPath(new URL("../mod.ts", import.meta.url));

async function writeTempModule(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "teta-test-"));
  createdDirs.push(directory);

  const file = join(directory, "query.ts");
  await writeFile(file, contents, "utf8");
  return file;
}

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("renderSqlFromSource", () => {
  test("is exported from mod.ts with the other dev helpers", () => {
    expect(typeof renderSqlFromSource).toBe("function");
    expect(typeof watchQuerySourceToClipboard).toBe("function");
    expect(typeof copyTextToClipboard).toBe("function");
  });

  test("renders SQL from an exported query object", async () => {
    const file = await writeTempModule(`
import { map, table, t } from ${JSON.stringify(modPath)};

const users = table("users", { id: t.int() });

export const query = map(users, (user) => ({ id: user.id }));
`);

    expect(await renderSqlFromSource(file)).toBe(
      "SELECT users_0.id FROM users AS users_0"
    );
  });

  test("returns direct SQL string exports", async () => {
    const file = await writeTempModule('export const query = "SELECT 1";');

    expect(await renderSqlFromSource(file)).toBe("SELECT 1");
  });

  test("throws when the requested export is missing", async () => {
    const file = await writeTempModule("export const notQuery = 1;");

    await expect(renderSqlFromSource(file)).rejects.toThrow(
      missingQueryExportError(file)
    );
  });
});
