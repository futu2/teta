import type { SqlOptions } from "@teta/teta";
import {
  importSourceModule,
  normalizeRenderSourcePath,
  renderSourceModuleUrl,
  resolveRenderedSqlFromModule,
} from "./render_source_shared.ts";

export type { QueryLike } from "./render_source_shared.ts";
export { isQueryLike } from "./render_source_shared.ts";
export {
  isolatedRenderRuntimeArgs,
  parseIsolatedRenderPayload,
  renderSqlFromSourceIsolated,
  serializeRendererOptions,
  type IsolatedRenderResult,
} from "./render_source_isolated.ts";

export async function renderSqlFromSource(
  source: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): Promise<string> {
  const sourcePath = normalizeRenderSourcePath(source);
  const moduleUrl = renderSourceModuleUrl(sourcePath);
  const importedModule = await importSourceModule(moduleUrl);
  return resolveRenderedSqlFromModule(importedModule, sourcePath, exportName, rendererOptions);
}
