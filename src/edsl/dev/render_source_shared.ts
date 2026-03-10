import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sqlRenderer, type SqlCompilable, type SqlOptions } from "../sql.ts";
import { userError } from "../errors.ts";

export type QueryLike = SqlCompilable;

export function normalizeRenderSourcePath(source: string): string {
  const sourcePath = source.toString().trim();
  if (!sourcePath) {
    userError("INVALID_TABLE_SOURCE", "renderSqlFromSource requires a source path");
  }
  return sourcePath;
}

export function renderSourceModuleUrl(sourcePath: string): string {
  return `${pathToFileURL(resolve(sourcePath)).href}?t=${Date.now()}`;
}

export function importSourceModule(
  moduleUrl: string
): Promise<Record<string, unknown>> {
  const importer = new Function(
    "specifier",
    "return import(specifier);"
  ) as (specifier: string) => Promise<Record<string, unknown>>;
  return importer(moduleUrl);
}

export async function resolveRenderedSqlFromModule(
  importedModule: Record<string, unknown>,
  sourcePath: string,
  exportName = "query",
  rendererOptions: SqlOptions = {}
): Promise<string> {
  if (!(exportName in importedModule)) {
    userError("INVALID_TABLE_SOURCE", `Export '${exportName}' not found in ${sourcePath}`);
  }

  let target = importedModule[exportName];
  if (typeof target === "function") {
    target = await (target as (() => unknown | Promise<unknown>))();
  }

  if (typeof target === "string") {
    return target;
  }
  if (!isQueryLike(target)) {
    userError(
      "INVALID_TABLE_SOURCE",
      `Export '${exportName}' must be a SQL string, Query-like object, or a function returning one`
    );
  }
  return sqlRenderer(rendererOptions).toSql(target);
}

export function isQueryLike(value: unknown): value is QueryLike {
  if (typeof value !== "object" || value === null) return false;
  return (
    ("node" in value)
    || (
      "source" in value
      && "stages" in value
      && "columnNames" in value
      && "sourceScopeId" in value
    )
  );
}
