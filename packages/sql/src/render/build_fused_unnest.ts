import type { QueryDialect } from "../types.ts";
import { createDictionary } from "../dictionary.ts";
import type { Stage } from "../ir/types.ts";
import type { FromAst, ScopeBindings, SqlRenderContext } from "./types.ts";
import { exprToAst } from "./render.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import { bindFusedExpr, type ScopeExprLookup } from "./fused.ts";
import { buildUnnestFrom } from "./source_unnest.ts";
import { internalError } from "../errors.ts";

export type FusedUnnestFrom = {
  from: FromAst;
  bindings: ScopeBindings;
};

export function buildFusedUnnestFrom(
  stage: Extract<Stage, { kind: "unnest" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): FusedUnnestFrom {
  const alias = stage.as ?? fail("Unnest stage requires an alias");
  const bindings = createDictionary<string | null>(currentBindings);
  bindings[stage.rightScopeId] = alias;

  registerColumnIdentifierBindings(
    alias,
    stage.columnIdentifiers,
    dialect,
    renderContext
  );

  return {
    bindings,
    from: buildUnnestFrom(
      stage,
      exprToAst(bindFusedExpr(stage.expr, scopeExprs, currentBindings, dialect), renderContext),
      dialect,
      renderContext
    ),
  };
}

function fail(message: string): never {
  internalError("INTERNAL_UNNEST_ALIAS_REQUIRED", message);
}
