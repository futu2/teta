import { spawnSync } from "node:child_process";
import {
  TetaInternalError,
  TetaUserError,
  internalError,
  type TetaErrorCode,
  type TetaErrorKind,
  userError,
} from "../errors.ts";
import type { SqlOptions } from "../sql.ts";
import { normalizeRenderSourcePath } from "./render_source_shared.ts";

export type SerializedIsolatedRenderError = {
  kind: TetaErrorKind;
  code: TetaErrorCode;
  message: string;
  stack?: string;
};

export type IsolatedRenderResult =
  | { ok: true; sql: string }
  | { ok: false; error: SerializedIsolatedRenderError };

export const RENDER_RESULT_PREFIX = "__teta_render_sql__";

export const RENDER_SQL_EVAL_SCRIPT = String.raw`(async () => {
  const PREFIX = "__teta_render_sql__";
  const respond = (payload) => process.stdout.write(PREFIX + JSON.stringify(payload) + "\n");
  const fail = (kind, code, message, stack) => {
    respond({ ok: false, error: { kind, code, message, stack } });
    process.exitCode = 1;
  };
  let TetaError;
  try {
    const { resolve } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const errorsModule = await import(process.env.TETA_ERRORS_MODULE);
    TetaError = errorsModule.TetaError;
    const { userError } = errorsModule;
    const { sqlRenderer } = await import(process.env.TETA_SQL_RENDERER_MODULE);

    const source = (process.env.TETA_SOURCE ?? "").trim();
    if (!source) {
      userError("INVALID_TABLE_SOURCE", "renderSqlFromSource requires a source path");
    }

    const exportName = (process.env.TETA_EXPORT_NAME ?? "query").trim() || "query";
    const rendererOptions = JSON.parse(process.env.TETA_RENDERER_OPTIONS ?? "{}");
    const importedModule = await import(pathToFileURL(resolve(source)).href);

    if (!(exportName in importedModule)) {
      userError("INVALID_TABLE_SOURCE", "Export '" + exportName + "' not found in " + source);
    }

    let target = importedModule[exportName];
    if (typeof target === "function") {
      target = await target();
    }

    if (typeof target === "string") {
      respond({ ok: true, sql: target });
      return;
    }
    if (!target || typeof target !== "object") {
      userError(
        "INVALID_TABLE_SOURCE",
        "Export '" + exportName + "' must be a SQL string, Query-like object, or a function returning one"
      );
    }

    respond({ ok: true, sql: sqlRenderer(rendererOptions).toSql(target) });
  } catch (error) {
    if (error instanceof Error && error.name === "SyntaxError") {
      fail("user", "INVALID_RENDERER_OPTIONS", error.message, error.stack);
      return;
    }
    if (typeof TetaError === "function" && error instanceof TetaError) {
      fail(error.kind, error.code, error.message, error.stack);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    fail("internal", "INTERNAL_DEV_RENDER_FAILED", message, stack);
  }
})();`;

export function renderSqlFromSourceIsolated(
  source: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): string {
  const sourcePath = normalizeRenderSourcePath(source);
  const serializedRendererOptions = serializeRendererOptions(rendererOptions);

  const result = spawnSync(process.execPath, isolatedRenderRuntimeArgs(), {
    env: {
      ...process.env,
      TETA_SOURCE: sourcePath,
      TETA_EXPORT_NAME: exportName,
      TETA_RENDERER_OPTIONS: serializedRendererOptions,
      TETA_ERRORS_MODULE: new URL("../errors.ts", import.meta.url).href,
      TETA_SQL_RENDERER_MODULE: new URL("../sql.ts", import.meta.url).href,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    internalError(
      "INTERNAL_DEV_RENDER_FAILED",
      result.error.message || "Failed to spawn isolated SQL render process"
    );
  }

  const payload = parseIsolatedRenderPayload(result.stdout ?? "");
  if (result.status === 0 && payload?.ok) {
    return payload.sql;
  }
  if (payload?.ok === false) {
    rethrowIsolatedRenderError(payload.error);
  }

  const stderr = result.stderr?.trim() ?? "";
  const details = stderr
    || `Failed to render SQL in isolated process (exit ${result.status ?? "unknown"})`;
  internalError("INTERNAL_DEV_RENDER_FAILED", details);
}

export function serializeRendererOptions(rendererOptions: SqlOptions): string {
  try {
    const serialized = JSON.stringify(rendererOptions);
    if (serialized === undefined) {
      userError(
        "INVALID_RENDERER_OPTIONS",
        "watchQuerySourceToClipboard isolateModules mode requires JSON-serializable rendererOptions"
      );
    }
    return serialized;
  } catch {
    userError(
      "INVALID_RENDERER_OPTIONS",
      "watchQuerySourceToClipboard isolateModules mode requires JSON-serializable rendererOptions"
    );
  }
}

export function isolatedRenderRuntimeArgs(): string[] {
  return "bun" in process.versions
    ? ["--eval", RENDER_SQL_EVAL_SCRIPT]
    : ["--input-type=module", "--eval", RENDER_SQL_EVAL_SCRIPT];
}

export function parseIsolatedRenderPayload(stdout: string): IsolatedRenderResult | null {
  const markerIndex = stdout.lastIndexOf(RENDER_RESULT_PREFIX);
  if (markerIndex < 0) {
    return null;
  }

  const [payloadLineRaw = ""] = stdout
    .slice(markerIndex + RENDER_RESULT_PREFIX.length)
    .split(/\r?\n/, 1);
  const payloadLine = payloadLineRaw.trim();
  if (!payloadLine) {
    return null;
  }

  try {
    return JSON.parse(payloadLine) as IsolatedRenderResult;
  } catch {
    return null;
  }
}

export function rethrowIsolatedRenderError(error: SerializedIsolatedRenderError): never {
  if (error.kind === "user") {
    throw new TetaUserError(error.code, error.message);
  }
  throw new TetaInternalError(error.code, error.message);
}
