import type { Stage } from "../ir/types.ts";
import { createDictionary } from "../dictionary.ts";
import type { FromAst, ScopeBindings, SelectAst, SubqueryFromRef, TableFromAst } from "./types.ts";
import { ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast.ts";
import { getSqlRenderContext, bindExprScopes, exprToAst, lateralJoinPrefix } from "./render.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import {
  buildSqlSelectAst,
  buildTableFromRef,
  compileJoinSource,
} from "./source.ts";
import {
  renderBoundProjectionItems,
  type StageRenderContext,
} from "./stage_ast.ts";
import { internalError } from "../errors.ts";

export function buildJoinStageAst(
  stage: Extract<Stage, { kind: "join" }>,
  context: StageRenderContext,
  ctePrefix: string,
  allowJoinSubqueryHoist = true,
  allowIntermediateCtes = true
): SelectAst {
  const join = `${stage.joinType} JOIN`;
  const rightAlias = stage.as ?? fail("Join stage requires an alias");
  const joinBindings = createDictionary<string | null>(context.baseBindings);
  joinBindings[stage.rightScopeId] = rightAlias;

  registerColumnIdentifierBindings(
    rightAlias,
    stage.source.kind === "table"
      ? stage.source.columnIdentifiers
      : stage.source.query.columnIdentifiers,
    context.dialect,
    getSqlRenderContext()
  );

  return buildSqlSelectAst({
    from: [
      context.baseFrom,
      buildJoinFromRef(
        stage,
        context,
        joinBindings,
        ctePrefix,
        join,
        allowJoinSubqueryHoist,
        allowIntermediateCtes
      ),
    ],
    columns: renderBoundProjectionItems(stage.projectAll, joinBindings, context.dialect),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

function buildJoinFromRef(
  stage: Extract<Stage, { kind: "join" }>,
  context: StageRenderContext,
  joinBindings: ScopeBindings,
  ctePrefix: string,
  join: string,
  allowJoinSubqueryHoist: boolean,
  allowIntermediateCtes: boolean
): FromAst {
  const on = exprToAst(bindExprScopes(stage.on, joinBindings, context.dialect));
  const prefix = lateralJoinPrefix(stage.lateral, context.dialect);

  if (stage.source.kind === "table") {
    return {
      ...buildTableFromRef(
        {
          db: stage.source.db,
          schema: stage.source.schema,
          table: stage.source.table,
          alias: stage.as,
        },
        context.dialect
      ),
      join,
      prefix,
      on,
    };
  }

  const compiledSubquery = compileJoinSource(
    stage.source,
    `${ctePrefix}join_`,
    context.dialect,
    allowJoinSubqueryHoist,
    allowIntermediateCtes
  );
  const subqueryAst = stage.lateral
    ? ensureSelectAst(
        replaceOuterAlias(toParserSelect(compiledSubquery), context.baseAlias),
        "lateral join"
      )
    : compiledSubquery;

  const subqueryFrom: SubqueryFromRef = {
    expr: {
      ast: subqueryAst,
      tableList: [],
      columnList: [],
      parentheses: true,
    },
    as: stage.as,
    join,
    prefix,
    on,
  };
  return subqueryFrom;
}

function fail(message: string): never {
  internalError("INTERNAL_JOIN_ALIAS_REQUIRED", message);
}
