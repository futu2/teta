import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sqlRenderer, type SqlRenderer, type SqlOptions, type SqlResult } from "../sql";

export type QueryLike = {
  toSql: (renderer: SqlRenderer<any, SqlResult>) => string;
};

type IsolatedRenderResult =
  | { ok: true; sql: string }
  | { ok: false; error: string };

const RENDER_RESULT_PREFIX = "__teta_render_sql__";
const RENDER_SQL_EVAL_SCRIPT = String.raw`(async () => {
  const PREFIX = "__teta_render_sql__";
  const respond = (payload) => process.stdout.write(PREFIX + JSON.stringify(payload) + "\n");  try {
    const { resolve } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const source = (process.env.TETA_SOURCE ?? "").trim();
    if (!source) {
      throw new Error("renderSqlFromSource requires a source path");
    }

    const exportName = (process.env.TETA_EXPORT_NAME ?? "query").trim() || "query";
    const rendererOptions = JSON.parse(process.env.TETA_RENDERER_OPTIONS ?? "{}");
    const rendererModuleUrl = (process.env.TETA_SQL_RENDERER_MODULE ?? "").trim();
    if (!rendererModuleUrl) {
      throw new Error("renderSqlFromSource requires a renderer module path");
    }
    const { sqlRenderer } = await import(rendererModuleUrl);
    const importedModule = await import(pathToFileURL(resolve(source)).href);

    if (!(exportName in importedModule)) {
      throw new Error("Export '" + exportName + "' not found in " + source);
    }

    let target = importedModule[exportName];
    if (typeof target === "function") {
      target = await target();
    }

    if (typeof target === "string") {
      respond({ ok: true, sql: target });
      return;
    }
    if (!target || typeof target !== "object" || typeof target.toSql !== "function") {
      throw new Error(
        "Export '" + exportName + "' must be a SQL string, Query-like object, or a function returning one"
      );
    }

    respond({ ok: true, sql: target.toSql(sqlRenderer(rendererOptions)) });
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    respond({ ok: false, error: message });
    process.exitCode = 1;
  }
})();`;

export async function renderSqlFromSource(
  source: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): Promise<string> {
  const sourcePath = source.toString().trim();
  if (!sourcePath) {
    throw new Error("renderSqlFromSource requires a source path");
  }
  const moduleUrl = `${pathToFileURL(resolve(sourcePath)).href}?t=${Date.now()}`;
  const importedModule = (await import(moduleUrl)) as Record<string, unknown>;
  if (!(exportName in importedModule)) {
    throw new Error(`Export '${exportName}' not found in ${sourcePath}`);
  }

  let target = importedModule[exportName];
  if (typeof target === "function") {
    target = await (target as (() => unknown | Promise<unknown>))();
  }

  if (typeof target === "string") {
    return target;
  }
  if (!isQueryLike(target)) {
    throw new Error(
      `Export '${exportName}' must be a SQL string, Query-like object, or a function returning one`
    );
  }
  return target.toSql(sqlRenderer(rendererOptions));
}

export function renderSqlFromSourceIsolated(
  source: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): string {
  const sourcePath = source.toString().trim();
  if (!sourcePath) {
    throw new Error("renderSqlFromSource requires a source path");
  }

  let serializedRendererOptions = "{}";
  try {
    serializedRendererOptions = JSON.stringify(rendererOptions);
  } catch {
    throw new Error(
      "watchQuerySourceToClipboard isolateModules mode requires JSON-serializable rendererOptions"
    );
  }

  const runtimeArgs = "bun" in process.versions
    ? ["--eval", RENDER_SQL_EVAL_SCRIPT]
    : ["--input-type=module", "--eval", RENDER_SQL_EVAL_SCRIPT];
  const result = spawnSync(process.execPath, runtimeArgs, {
    env: {
      ...process.env,
      TETA_SOURCE: sourcePath,
      TETA_EXPORT_NAME: exportName,
      TETA_RENDERER_OPTIONS: serializedRendererOptions,
      TETA_SQL_RENDERER_MODULE: new URL("../sql.ts", import.meta.url).href,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = result.stdout ?? "";
  const markerIndex = stdout.lastIndexOf(RENDER_RESULT_PREFIX);
  let payload: IsolatedRenderResult | null = null;

  if (markerIndex >= 0) {
    const [payloadLineRaw = ""] = stdout
      .slice(markerIndex + RENDER_RESULT_PREFIX.length)
      .split(/\r?\n/, 1);
    const payloadLine = payloadLineRaw.trim();
    if (payloadLine) {
      try {
        payload = JSON.parse(payloadLine) as IsolatedRenderResult;
      } catch {
        payload = null;
      }
    }
  }

  if (result.status === 0 && payload?.ok) {
    return payload.sql;
  }

  const workerError = payload?.ok === false ? payload.error : "";
  const stderr = result.stderr?.trim() ?? "";
  const details = workerError || stderr
    || `Failed to render SQL in isolated process (exit ${result.status ?? "unknown"})`;
  throw new Error(details);
}

function isQueryLike(value: unknown): value is QueryLike {
  return typeof value === "object" && value !== null && "toSql" in value
    && typeof (value as Record<string, unknown>).toSql === "function";
}
