import { applyDialectLanguage } from "./language.ts";
import { applyDialectFixes } from "./render/fixes.ts";
import { renderPipelineAst } from "./render/pipeline.ts";
import { withSqlRenderContext } from "./render/render.ts";
import { createRenderContext, renderAst, renderExprNode } from "./renderer_output.ts";
import type {
  ExprSqlTarget,
  QueryIRSqlTarget,
  RendererState,
} from "./renderer_types.ts";
import type { ExprNode } from "./ir/types.ts";
import {
  collectExprParameterNames,
  collectQueryParameterNames,
} from "./ir/parameters.ts";
import { validateExprIR } from "./ir/validate.ts";
import type { SqlResult } from "./types.ts";

export function renderQueryIRTarget(
  target: QueryIRSqlTarget,
  state: RendererState
): SqlResult {
  const renderContext = createRenderContext(state, collectQueryParameterNames(target));
  const ast = withSqlRenderContext(renderContext, () =>
    applyDialectFixes(
      renderPipelineAst(target.source, target.stages, target.columnNames, target.scopeId, {
        baseCtes: target.withs ?? [],
        columnIdentifiers: target.columnIdentifiers,
        dialect: state.dialect,
        renderStrategy: state.renderStrategy,
      }),
      state.dialect
    )
  );

  return {
    sql: renderAst(ast, state),
    params: renderContext.params,
  };
}

export function renderExprTarget(
  target: ExprSqlTarget,
  state: RendererState
): SqlResult {
  validateExprIR(target);
  const node = unwrapExprTarget(target);
  const renderContext = createRenderContext(state, collectExprParameterNames(node));
  const expr = applyDialectLanguage(node, state.dialect);

  return {
    sql: withSqlRenderContext(renderContext, () =>
      renderExprNode(expr, state)
    ),
    params: renderContext.params,
  };
}

function unwrapExprTarget(target: ExprSqlTarget): ExprNode<unknown> {
  return "node" in target ? target.node : target;
}
