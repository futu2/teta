import type { AST } from "node-sql-parser";
import type { CteSpec, ScopeId, Source, SqlIdentifier, Stage } from "../ir/types.ts";
import type { QueryDialect, SqlRenderStrategy } from "../types.ts";
import type { ScopeBindings } from "./types.ts";
import type { SqlRenderContext } from "./types.ts";
import { buildPipelineAst } from "./build.ts";
import { getDefaultDialect } from "../dialect.ts";
import { createAstRenderContext } from "./render_context.ts";
import { buildPipelineParserAst, materializeBaseCtes } from "./pipeline_cte.ts";
import { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive.ts";

/** Recursive CTE helpers used by the pipeline renderer. */
export { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive.ts";

/** Options for lowering a query pipeline into a parser AST. */
export type RenderPipelineOptions = {
  ctePrefix?: string;
  baseCtes?: readonly CteSpec[];
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
  renderStrategy?: SqlRenderStrategy;
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  renderContext?: SqlRenderContext;
};

/** Render a source and lowered stages into a `node-sql-parser` AST. */
export function renderPipelineAst(
  source: Source,
  stages: readonly Stage[],
  columnNames: readonly string[],
  scopeId: ScopeId,
  options?: RenderPipelineOptions
): AST {
  const dialect = options?.dialect ?? getDefaultDialect();
  const renderContext = options?.renderContext ?? createAstRenderContext(dialect);
  const baseCtes = materializeBaseCtes(options?.baseCtes ?? [], dialect, renderContext);
  const { ast, ctes } = buildPipelineAst(source, stages, columnNames, scopeId, {
    ...options,
    dialect,
    renderContext,
  });
  return buildPipelineParserAst(ast, baseCtes, ctes);
}
