import type { Stage } from "../../core/types";
import type { ScopeBindings, SelectAst } from "./types";
import { ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast";
import { getSqlRenderContext, bindExprScopes, exprToAst, lateralJoinPrefix } from "./render";
import { registerColumnIdentifierBindings } from "./identifiers";
import {
  buildSelectAst,
  buildTableFromRef,
  compileJoinSource,
} from "./source";
import {
  renderBoundSelectItems,
  type StageSelectContext,
} from "./select_stage";

export function buildJoinStageAst(
  stage: Extract<Stage, { kind: "join" }>,
  context: StageSelectContext,
  ctePrefix: string
): SelectAst {
  const join = `${stage.joinType} JOIN`;
  const rightAlias = stage.as ?? fail("Join stage requires an alias");
  const joinBindings: ScopeBindings = {
    ...context.baseBindings,
    [stage.rightScopeId]: rightAlias,
  };

  registerColumnIdentifierBindings(
    rightAlias,
    stage.source.kind === "table"
      ? stage.source.columnIdentifiers ?? null
      : stage.source.query.columnIdentifiers,
    context.dialect,
    getSqlRenderContext()
  );

  return buildSelectAst({
    from: [
      context.baseFrom,
      buildJoinFromRef(stage, context, joinBindings, ctePrefix, join),
    ],
    columns: renderBoundSelectItems(stage.selectAll, joinBindings, context.dialect),
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
  context: StageSelectContext,
  joinBindings: ScopeBindings,
  ctePrefix: string,
  join: string
): unknown {
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
    context.dialect
  );
  const subqueryAst = stage.lateral
    ? ensureSelectAst(
        replaceOuterAlias(toParserSelect(compiledSubquery), context.baseAlias),
        "lateral join"
      )
    : compiledSubquery;

  return {
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
}

function fail(message: string): never {
  throw new Error(message);
}
