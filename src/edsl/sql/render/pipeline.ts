import type { AST } from "node-sql-parser";
import type { CteSpec, Source, Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ScopeBindings } from "./types";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { withPipelineAstRenderContext } from "./pipeline_context";
import { buildPipelineParserAst, materializeBaseCtes } from "./pipeline_cte";
import { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive";

export { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive";

export type RenderPipelineOptions = {
  ctePrefix?: string;
  baseCtes?: CteSpec[];
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
};

export function renderPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[] | null,
  scopeId: string,
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
