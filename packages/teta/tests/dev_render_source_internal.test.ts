import { afterEach, describe, expect, test } from "bun:test";

import { TetaUserError } from "../mod.ts";
import {
  parseIsolatedRenderPayload,
  renderSqlFromSourceIsolated,
  serializeRendererOptions,
} from "../src/edsl/dev/render_source.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const createdDirs: string[] = [];

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

describe("render source internal helpers", () => {
  test("parseIsolatedRenderPayload reads the last payload marker", () => {
    expect(
      parseIsolatedRenderPayload(
        `noise\n__teta_render_sql__${JSON.stringify({ ok: true, sql: "SELECT 1" })}\n`
      )
    ).toEqual({ ok: true, sql: "SELECT 1" });
  });

  test("serializeRendererOptions rejects non-serializable options with a user error", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    try {
      serializeRendererOptions(circular as never);
      throw new Error("Expected serializeRendererOptions() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("INVALID_RENDERER_OPTIONS");
      expect((error as TetaUserError).message).toContain("requires JSON-serializable rendererOptions");
    }
  });

  test("renderSqlFromSourceIsolated returns direct SQL string exports", async () => {
    const file = await writeTempModule('export const query = "SELECT 42";');
    expect(renderSqlFromSourceIsolated(file)).toBe("SELECT 42");
  });

  test("renderSqlFromSourceIsolated preserves user-facing missing export errors", async () => {
    const file = await writeTempModule("export const notQuery = 1;");

    try {
      renderSqlFromSourceIsolated(file);
      throw new Error("Expected renderSqlFromSourceIsolated() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TetaUserError);
      expect((error as TetaUserError).code).toBe("INVALID_TABLE_SOURCE");
      expect((error as TetaUserError).message).toBe(`Export 'query' not found in ${file}`);
    }
  });
});
