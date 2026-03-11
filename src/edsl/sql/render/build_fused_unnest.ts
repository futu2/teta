import type { QueryDialect } from "../types.ts";
import type { Stage } from "../../core/types.ts";
import type { FromAst, ScopeBindings } from "./types.ts";
import { exprToAst, getSqlRenderContext } from "./render.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import { bindFusedExpr, type ScopeExprLookup } from "./fused.ts";
import { buildUnnestFrom } from "./source_unnest.ts";
import { internalError } from "../../errors.ts";

export type FusedUnnestFrom = {
  from: FromAst;
  bindings: ScopeBindings;
};

export function buildFusedUnnestFrom(
  stage: Extract<Stage, { kind: "unnest" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  dialect: QueryDialect
): FusedUnnestFrom {
  const alias = stage.as ?? fail("Unnest stage requires an alias");
  const bindings: ScopeBindings = {
    ...currentBindings,
    [stage.rightScopeId]: alias,
  };

  registerColumnIdentifierBindings(
    alias,
    stage.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );

  return {
    bindings,
    from: buildUnnestFrom(
      stage,
      exprToAst(bindFusedExpr(stage.expr, scopeExprs, currentBindings, dialect)),
      dialect
    ),
  };
}

function fail(message: string): never {
  internalError("INTERNAL_UNNEST_ALIAS_REQUIRED", message);
}
