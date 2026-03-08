import type { With } from "node-sql-parser";
import type { Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ScopeBindings, SelectAst } from "./types";
import { ensureAlias, toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers";
import { buildSelectAst, sourceToFrom, type CompileSourceRef } from "./select";

export function compileUnionStage(
  stage: Extract<Stage, { kind: "union" }>,
  source: CompileSourceRef,
  leftScopeId: string,
  ctes: With[],
  rightPrefix: string,
  inheritedBindings?: ScopeBindings,
  dialect: QueryDialect = getDefaultDialect()
): SelectAst {
  const baseFrom = sourceToFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers ?? null,
    dialect,
    getSqlRenderContext()
  );
  const leftBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [leftScopeId]: baseAlias,
  };
  const leftAst = buildSelectAst({
    from: [baseFrom],
    columns: stage.selectAll.map((item) => ({
      expr: exprToAst(bindExprScopes(item.expr, leftBindings, dialect)),
      as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
    })),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });

  const rightCompiled = buildPipelineAst(
    stage.right.source,
    stage.right.stages,
    stage.right.columnNames,
    stage.right.scopeId,
    {
      ctePrefix: rightPrefix,
      scopeBindings: inheritedBindings,
      dialect,
    }
  );
  if (rightCompiled.ctes.length) {
    ctes.push(...rightCompiled.ctes);
  }
  const rightAst = rightCompiled.ast;
  rightAst.with = null;

  return attachUnion(leftAst, rightAst, stage.op);
}

export function attachUnion(
  left: SelectAst,
  right: SelectAst,
  op: "union" | "union all"
): SelectAst {
  left.set_op = op;
  left._next = toParserSelect(right);
  return left;
}
