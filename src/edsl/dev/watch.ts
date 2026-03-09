import { watch as watchFs } from "node:fs";
import { writeFile } from "node:fs/promises";
import { copyTextToClipboard } from "./clipboard";
import {
  renderSqlFromSource,
  renderSqlFromSourceIsolated,
} from "./render_source";
import type { WatchQueryController, WatchQuerySourceOptions } from "./watch_shared";
import { resolveWatchQuerySourceOptions } from "./watch_shared";

export async function watchQuerySourceToClipboard(
  options: WatchQuerySourceOptions
): Promise<WatchQueryController> {
  const resolved = resolveWatchQuerySourceOptions(options);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();

  const runOnce = async (): Promise<string> => {
    const sql = resolved.isolateModules
      ? renderSqlFromSourceIsolated(
          resolved.source,
          resolved.exportName,
          resolved.rendererOptions
        )
      : await renderSqlFromSource(
          resolved.source,
          resolved.exportName,
          resolved.rendererOptions
        );

    if (resolved.outputFile) {
      await writeFile(resolved.outputFile, sql, "utf8");
      resolved.log(`[teta-watch] wrote SQL to ${resolved.outputFile}`);
    }

    if (resolved.shouldCopy) {
      const tool = copyTextToClipboard(sql, resolved.clipboard);
      resolved.log(`[teta-watch] copied SQL to clipboard via ${tool}`);
    }

    resolved.onSql?.(sql);
    return sql;
  };

  const enqueueRun = () => {
    queue = queue
      .then(async () => {
        if (stopped) return;
        await runOnce();
      })
      .catch(resolved.onError);
  };

  const scheduleRun = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      enqueueRun();
    }, resolved.debounceMs);
  };

  const watchers = resolved.watchPaths.map((watchPath) =>
    watchFs(watchPath, { persistent: true }, () => {
      scheduleRun();
    })
  );

  if (resolved.runImmediately) {
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
