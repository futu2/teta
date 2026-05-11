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

const createdDirs: string[] = [];
const coreModPath = fileURLToPath(new URL("../../teta/mod.ts", import.meta.url));

async function writeTempModule(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "teta-dev-test-"));
  createdDirs.push(directory);
  const file = join(directory, "query.ts");
  await writeFile(file, contents, "utf8");
  return file;
}

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("dev package public api", () => {
  test("exports the render and watch helpers", () => {
    expect(typeof copyTextToClipboard).toBe("function");
    expect(typeof renderSqlFromSource).toBe("function");
    expect(typeof watchQuerySourceToClipboard).toBe("function");
  });

  test("renders SQL from a query exported from a source module", async () => {
    const file = await writeTempModule(`
import { map, table, t } from ${JSON.stringify(coreModPath)};

const pipe = (value, ...steps) => steps.reduce((current, step) => step(current), value);
const users = table("users", { id: t.int() });

export const query = pipe(users, map((user) => ({ id: user.id })));
`);

    expect(await renderSqlFromSource(file)).toBe(
      "SELECT users_0.id FROM users AS users_0"
    );
  });
});
