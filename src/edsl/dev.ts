import { watch as watchFs } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { sqlRenderer, type SqlRenderer, type SqlOptions, type SqlResult } from "./sql";

export type ClipboardTool =
  | "auto"
  | "xclip"
  | "xsel"
  | "wl-copy"
  | "pbcopy"
  | "clip";

export type QueryLike = {
  toSql: (renderer: SqlRenderer<any, SqlResult>) => string;
};

export type WatchQuerySourceOptions = {
  source: string;
  watchPaths?: string | string[];
  exportName?: string;
  rendererOptions?: SqlOptions;
  isolateModules?: boolean;
  outputFile?: string;
  copyToClipboard?: boolean;
  clipboard?: ClipboardTool;
  debounceMs?: number;
  runImmediately?: boolean;
  onSql?: (sql: string) => void;
  onError?: (error: unknown) => void;
  log?: (message: string) => void;
};

export type WatchQueryController = {
  stop: () => void;
  runOnce: () => Promise<string>;
};

type ClipboardCommand = {
  command: string;
  args: string[];
};

type IsolatedRenderResult =
  | { ok: true; sql: string }
  | { ok: false; error: string };

const CLIPBOARD_COMMANDS: Record<Exclude<ClipboardTool, "auto">, ClipboardCommand> = {
  "wl-copy": { command: "wl-copy", args: [] },
  xclip: { command: "xclip", args: ["-selection", "clipboard"] },
  xsel: { command: "xsel", args: ["--clipboard", "--input"] },
  pbcopy: { command: "pbcopy", args: [] },
  clip: { command: "clip", args: [] },
};

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

export function copyTextToClipboard(
  text: string,
  preferred: ClipboardTool = "auto"
): string {
  const candidates = resolveClipboardCandidates(preferred);
  for (const candidate of candidates) {
    const command = CLIPBOARD_COMMANDS[candidate];
    const result = spawnSync(command.command, command.args, {
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
    });
    if (result.status === 0 && !result.error) {
      return candidate;
    }
  }
  throw new Error(
    "Unable to copy SQL to clipboard. Install one of: wl-copy, xclip, xsel, pbcopy, or clip."
  );
}

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

function renderSqlFromSourceIsolated(
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
      TETA_SQL_RENDERER_MODULE: new URL("./sql.ts", import.meta.url).href,
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

  const workerError = payload && !payload.ok ? payload.error : "";
  const stderr = result.stderr?.trim() ?? "";
  const details = workerError || stderr
    || `Failed to render SQL in isolated process (exit ${result.status ?? "unknown"})`;
  throw new Error(details);
}

export async function watchQuerySourceToClipboard(
  options: WatchQuerySourceOptions
): Promise<WatchQueryController> {
  const source = options.source.toString().trim();
  if (!source) {
    throw new Error("watchQuerySourceToClipboard requires a non-empty source path");
  }

  const exportName = options.exportName?.trim() || "query";
  const watchPaths = normalizeWatchPaths(source, options.watchPaths);
  const debounceMs = options.debounceMs ?? 120;
  const isolateModules = options.isolateModules ?? true;
  const clipboard = options.clipboard ?? "auto";
  const shouldCopy = options.copyToClipboard ?? true;
  const log = options.log ?? ((message: string) => console.log(message));
  const onError =
    options.onError ??
    ((error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      console.error(`[teta-watch] ${text}`);
    });

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();

  const runOnce = async (): Promise<string> => {
    const sql = isolateModules
      ? renderSqlFromSourceIsolated(source, exportName, options.rendererOptions ?? {})
      : await renderSqlFromSource(source, exportName, options.rendererOptions ?? {});

    if (options.outputFile) {
      await writeFile(options.outputFile, sql, "utf8");
      log(`[teta-watch] wrote SQL to ${options.outputFile}`);
    }

    if (shouldCopy) {
      const tool = copyTextToClipboard(sql, clipboard);
      log(`[teta-watch] copied SQL to clipboard via ${tool}`);
    }

    options.onSql?.(sql);
    return sql;
  };

  const enqueueRun = () => {
    queue = queue
      .then(async () => {
        if (stopped) return;
        await runOnce();
      })
      .catch(onError);
  };

  const scheduleRun = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      enqueueRun();
    }, debounceMs);
  };

  const watchers = watchPaths.map((watchPath) =>
    watchFs(watchPath, { persistent: true }, () => {
      scheduleRun();
    })
  );

  if (options.runImmediately !== false) {
    enqueueRun();
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    for (const watcher of watchers) {
      watcher.close();
    }
  };

  return {
    stop,
    runOnce,
  };
}

function isQueryLike(value: unknown): value is QueryLike {
  return typeof value === "object" && value !== null && "toSql" in value
    && typeof (value as Record<string, unknown>).toSql === "function";
}


function normalizeWatchPaths(source: string, watchPaths?: string | string[]): string[] {
  if (!watchPaths) return [source];
  if (typeof watchPaths === "string") {
    const value = watchPaths.trim();
    return value ? [value] : [source];
  }
  const normalized = watchPaths
    .map((item) => item.toString().trim())
    .filter((item) => item.length > 0);
  return normalized.length ? normalized : [source];
}

function resolveClipboardCandidates(tool: ClipboardTool): Exclude<ClipboardTool, "auto">[] {
  if (tool !== "auto") return [tool];
  switch (process.platform) {
    case "darwin":
      return ["pbcopy", "wl-copy", "xclip", "xsel"];
    case "win32":
      return ["clip"];
    default:
      return ["wl-copy", "xclip", "xsel", "pbcopy", "clip"];
  }
}
