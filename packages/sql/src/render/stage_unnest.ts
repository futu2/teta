import type { Stage } from "../ir/types.ts";
import { createDictionary } from "../dictionary.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { bindExprScopes, exprToAst } from "./render.ts";
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
  const bindings = createDictionary<string | null>(context.baseBindings);
  bindings[stage.rightScopeId] = alias;

  registerColumnIdentifierBindings(
    alias,
    stage.columnIdentifiers,
    context.dialect,
    context.renderContext
  );

  return buildSqlSelectAst({
    from: [
      context.baseFrom,
      buildUnnestFrom(
        stage,
        exprToAst(
          bindExprScopes(stage.expr, context.baseBindings, context.dialect),
          context.renderContext
        ),
        context.dialect,
        context.renderContext
      ),
    ],
    columns: renderBoundProjectionItems(
      stage.projectAll,
      bindings,
      context.dialect,
      context.renderContext
    ),
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
