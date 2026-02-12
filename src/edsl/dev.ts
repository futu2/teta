import { watch as watchFs } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export type ClipboardTool =
  | "auto"
  | "xclip"
  | "xsel"
  | "wl-copy"
  | "pbcopy"
  | "clip";

export type QueryLike = {
  toSql: (...args: any[]) => string;
};

export type WatchQuerySourceOptions = {
  source: string;
  watchPaths?: string | string[];
  exportName?: string;
  toSqlArgs?: unknown[];
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

const CLIPBOARD_COMMANDS: Record<Exclude<ClipboardTool, "auto">, ClipboardCommand> = {
  "wl-copy": { command: "wl-copy", args: [] },
  xclip: { command: "xclip", args: ["-selection", "clipboard"] },
  xsel: { command: "xsel", args: ["--clipboard", "--input"] },
  pbcopy: { command: "pbcopy", args: [] },
  clip: { command: "clip", args: [] },
};

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
  toSqlArgs: readonly unknown[] = []
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
  return target.toSql(...toSqlArgs);
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
    const sql = await renderSqlFromSource(source, exportName, options.toSqlArgs ?? []);

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
