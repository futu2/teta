import type { With } from "node-sql-parser";
import type { ScopeId, Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { ensureAlias, toParserSelect } from "./ast.ts";
import { buildPipelineAst } from "./build.ts";
import { getDefaultDialect } from "../dialect.ts";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render.ts";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers.ts";
import { buildSqlSelectAst, sourceToFrom, type CompileSourceRef } from "./source.ts";

export function compileUnionStage(
  stage: Extract<Stage, { kind: "union" }>,
  source: CompileSourceRef,
  leftScopeId: ScopeId,
  ctes: With[],
  rightPrefix: string,
  inheritedBindings?: ScopeBindings,
  dialect: QueryDialect = getDefaultDialect()
): SelectAst {
  const baseFrom = sourceToFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
  const leftBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [leftScopeId]: baseAlias,
  };
  const leftAst = buildSqlSelectAst({
    from: [baseFrom],
    columns: stage.projectAll.map((item) => ({
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
