import type { Stage } from "../ir/types.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import { buildSqlSelectAst } from "./source.ts";
import { buildUnnestFrom } from "./source_unnest.ts";
import {
  renderBoundProjectionItems,
  type StageRenderContext,
} from "./stage_ast.ts";
import { internalError } from "../errors.ts";

export function buildUnnestStageAst(
  stage: Extract<Stage, { kind: "unnest" }>,
  context: StageRenderContext
): SelectAst {
  const alias = stage.as ?? fail("Unnest stage requires an alias");
  const bindings: ScopeBindings = {
    ...context.baseBindings,
    [stage.rightScopeId]: alias,
  };

  registerColumnIdentifierBindings(
    alias,
    stage.columnIdentifiers,
    context.dialect,
    getSqlRenderContext()
  );

  return buildSqlSelectAst({
    from: [
      context.baseFrom,
      buildUnnestFrom(
        stage,
        exprToAst(bindExprScopes(stage.expr, context.baseBindings, context.dialect)),
        context.dialect
      ),
    ],
    columns: renderBoundProjectionItems(stage.projectAll, bindings, context.dialect),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

function fail(message: string): never {
  internalError("INTERNAL_UNNEST_ALIAS_REQUIRED", message);
}
