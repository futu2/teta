import { watch as watchFs } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { SqlOptions } from "./sql";
import { copyTextToClipboard, type ClipboardTool } from "./dev/clipboard";
import {
  renderSqlFromSource,
  renderSqlFromSourceIsolated,
  type QueryLike,
} from "./dev/render_source";

export { copyTextToClipboard, renderSqlFromSource };
export type { ClipboardTool, QueryLike };

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
