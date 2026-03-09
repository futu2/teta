import type { SqlOptions } from "../sql";
import { renderSourceModuleUrl, normalizeRenderSourcePath, resolveRenderedSqlFromModule } from "./render_source_shared";

export type { QueryLike } from "./render_source_shared";
export {
  isolatedRenderRuntimeArgs,
  parseIsolatedRenderPayload,
  renderSqlFromSourceIsolated,
  serializeRendererOptions,
  type IsolatedRenderResult,
} from "./render_source_isolated";

export async function renderSqlFromSource(
  source: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): Promise<string> {
  const sourcePath = normalizeRenderSourcePath(source);
  const moduleUrl = renderSourceModuleUrl(sourcePath);
  const importedModule = (await import(moduleUrl)) as Record<string, unknown>;
  return resolveRenderedSqlFromModule(importedModule, sourcePath, exportName, rendererOptions);
}
