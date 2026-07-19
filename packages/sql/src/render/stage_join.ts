import type { Stage } from "../ir/types.ts";
import { createDictionary } from "../dictionary.ts";
import type { FromAst, ScopeBindings, SelectAst, SubqueryFromRef } from "./types.ts";
import { ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast.ts";
import { bindExprScopes, exprToAst, lateralJoinPrefix } from "./render.ts";
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
    stage.source.kind === "subquery"
      ? stage.source.query.columnIdentifiers
      : stage.source.columnIdentifiers,
    context.dialect,
    context.renderContext
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
    columns: renderBoundProjectionItems(
      stage.projectAll,
      joinBindings,
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

function buildJoinFromRef(
  stage: Extract<Stage, { kind: "join" }>,
  context: StageRenderContext,
  joinBindings: ScopeBindings,
  ctePrefix: string,
  join: string,
  allowJoinSubqueryHoist: boolean,
  allowIntermediateCtes: boolean
): FromAst {
  const on = exprToAst(
    bindExprScopes(stage.on, joinBindings, context.dialect),
    context.renderContext
  );
  const prefix = lateralJoinPrefix(stage.lateral, context.dialect);

  if (stage.source.kind === "table" || stage.source.kind === "cte") {
    return {
      ...buildTableFromRef(
        {
          db: stage.source.kind === "table" ? stage.source.db : null,
          schema: stage.source.kind === "table" ? stage.source.schema : null,
          table: stage.source.kind === "table"
            ? stage.source.table
            : { name: stage.source.name, quoted: false },
          alias: stage.as,
        },
        context.dialect,
        context.renderContext
      ),
      join,
      prefix,
      on,
    };
  }

  const compiledSubquery = compileJoinSource(
    stage.source,
    `${ctePrefix}derived_`,
    context.dialect,
    allowJoinSubqueryHoist,
    allowIntermediateCtes,
    context.renderContext
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
