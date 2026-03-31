import type { AST } from "node-sql-parser";
import type { CteSpec, ScopeId, Source, Stage } from "../../core/types.ts";
import type { QueryDialect, SqlRenderStrategy } from "../types.ts";
import type { ScopeBindings } from "./types.ts";
import { buildPipelineAst } from "./build.ts";
import { getDefaultDialect } from "../dialect.ts";
import { withPipelineAstRenderContext } from "./pipeline_context.ts";
import { buildPipelineParserAst, materializeBaseCtes } from "./pipeline_cte.ts";
import { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive.ts";

export { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive.ts";

export type RenderPipelineOptions = {
  ctePrefix?: string;
  baseCtes?: CteSpec[];
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
  renderStrategy?: SqlRenderStrategy;
};

export function renderPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[],
  scopeId: ScopeId,
  options?: RenderPipelineOptions
): AST {
  const dialect = options?.dialect ?? getDefaultDialect();
  return withPipelineAstRenderContext(() => {
    const baseCtes = materializeBaseCtes(options?.baseCtes ?? [], dialect);
    const { ast, ctes } = buildPipelineAst(source, stages, columnNames, scopeId, {
      ...options,
      dialect,
    });
    return buildPipelineParserAst(ast, baseCtes, ctes);
  });
}
