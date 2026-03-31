import { TetaUserError, type SqlOptions } from "@teta/teta";
import type { ClipboardTool } from "./clipboard.ts";

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

export type ResolvedWatchQuerySourceOptions = {
  source: string;
  exportName: string;
  watchPaths: string[];
  rendererOptions: SqlOptions;
  isolateModules: boolean;
  outputFile: string | undefined;
  shouldCopy: boolean;
  clipboard: ClipboardTool;
  debounceMs: number;
  runImmediately: boolean;
  onSql: ((sql: string) => void) | undefined;
  onError: (error: unknown) => void;
  log: (message: string) => void;
};

export function resolveWatchQuerySourceOptions(
  options: WatchQuerySourceOptions
): ResolvedWatchQuerySourceOptions {
  const source = options.source.toString().trim();
  if (!source) {
    throw new TetaUserError("INVALID_TABLE_SOURCE", "watchQuerySourceToClipboard requires a non-empty source path");
  }

  return {
    source,
    exportName: options.exportName?.trim() || "query",
    watchPaths: normalizeWatchPaths(source, options.watchPaths),
    rendererOptions: options.rendererOptions ?? {},
    isolateModules: options.isolateModules ?? true,
    outputFile: options.outputFile,
    shouldCopy: options.copyToClipboard ?? true,
    clipboard: options.clipboard ?? "auto",
    debounceMs: options.debounceMs ?? 120,
    runImmediately: options.runImmediately !== false,
    onSql: options.onSql,
    onError:
      options.onError ??
      ((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        console.error(`[teta-watch] ${text}`);
      }),
    log: options.log ?? ((message: string) => console.log(message)),
  };
}

export function normalizeWatchPaths(source: string, watchPaths?: string | string[]): string[] {
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
