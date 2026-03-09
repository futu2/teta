import { applyDialectLanguage } from "./language";
import { applyDialectFixes } from "./render/fixes";
import { renderPipelineAst } from "./render/pipeline";
import { withSqlRenderContext } from "./render/render";
import type { SqlRenderContext } from "./render/types";
import { createRenderContext, renderAst, renderExprNode } from "./renderer_output";
import type {
  ExprSqlTarget,
  QuerySqlTarget,
  RendererState,
  SqlCompilable,
} from "./renderer_types";
import type { SqlResult } from "./types";

export function renderQueryTarget(
  target: QuerySqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const ast = withSqlRenderContext(renderContext, () =>
    applyDialectFixes(
      renderPipelineAst(target.source, target.stages, target.columnNames, target.sourceScopeId, {
        baseCtes: target.withs ?? [],
        dialect: state.dialect,
      }),
      state.dialect
    )
  );

  return {
    sql: renderAst(ast, state, renderContext),
    params: renderContext.params,
  };
}

export function renderExprTarget(
  target: ExprSqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state);
  const expr = applyDialectLanguage(target.node, state.dialect);

  return {
    sql: withSqlRenderContext(renderContext, () =>
      renderExprNode(expr, state, renderContext)
    ),
    params: renderContext.params,
  };
}

export function isExprSqlTarget(value: SqlCompilable): value is ExprSqlTarget {
  return "node" in value;
}
