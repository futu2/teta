import type { With } from "node-sql-parser";
import { createDictionary } from "../dictionary.ts";
import type { ScopeId, Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { ScopeBindings, SelectAst, SqlRenderContext } from "./types.ts";
import { ensureAlias, toParserSelect } from "./ast.ts";
import { buildPipelineAst } from "./build.ts";
import { getDefaultDialect } from "../dialect.ts";
import { bindExprScopes, exprToAst } from "./render.ts";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers.ts";
import { buildSqlSelectAst, sourceToFrom, type CompileSourceRef } from "./source.ts";

export function compileUnionStage(
  stage: Extract<Stage, { kind: "union" }>,
  source: CompileSourceRef,
  leftScopeId: ScopeId,
  ctes: With[],
  rightPrefix: string,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): SelectAst {
  const baseFrom = sourceToFrom(source, dialect, renderContext);
  const baseAlias = ensureAlias(baseFrom);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers,
    dialect,
    renderContext
  );
  const leftBindings = createDictionary<string | null>(inheritedBindings);
  leftBindings[leftScopeId] = baseAlias;
  const leftAst = buildSqlSelectAst({
    from: [baseFrom],
    columns: stage.projectAll.map((item) => ({
      expr: exprToAst(bindExprScopes(item.expr, leftBindings, dialect), renderContext),
      as: renderIdentifier(item.as, dialect, renderContext),
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
      columnIdentifiers: stage.right.columnIdentifiers,
      scopeBindings: inheritedBindings,
      dialect,
      renderContext,
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
