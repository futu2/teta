import type { QueryDialect } from "../types.ts";
import type { Stage } from "../ir/types.ts";
import type { FromAst, ScopeBindings, SubqueryFromRef } from "./types.ts";
import { ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast.ts";
import { exprToAst, getSqlRenderContext, lateralJoinPrefix } from "./render.ts";
import { buildTableFromRef, compileJoinSource } from "./source.ts";
import { registerColumnIdentifierBindings } from "./identifiers.ts";
import { bindFusedExpr, type ScopeExprLookup } from "./fused.ts";
import { internalError } from "../errors.ts";

export type FusedJoinFrom = {
  from: FromAst;
  bindings: ScopeBindings;
};

export function buildFusedJoinFrom(
  stage: Extract<Stage, { kind: "join" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  baseAlias: string,
  ctePrefix: string,
  dialect: QueryDialect,
  allowJoinSubqueryHoist = true,
  allowIntermediateCtes = true
): FusedJoinFrom {
  const alias = stage.as ?? fail("Join stage requires an alias");
  const joinBindings: ScopeBindings = {
    ...currentBindings,
    [stage.rightScopeId]: alias,
  };
  const join = `${stage.joinType} JOIN`;
  registerColumnIdentifierBindings(
    alias,
    stage.source.kind === "table"
      ? stage.source.columnIdentifiers
      : stage.source.query.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );

  if (stage.source.kind === "table") {
    return {
      bindings: joinBindings,
      from: {
        ...buildTableFromRef(
          {
            db: stage.source.db,
            schema: stage.source.schema,
            table: stage.source.table,
            alias: stage.as,
          },
          dialect
        ),
        join,
        prefix: lateralJoinPrefix(stage.lateral, dialect),
        on: exprToAst(bindFusedExpr(stage.on, scopeExprs, joinBindings, dialect)),
      },
    };
  }

  const compiledSubquery = compileJoinSource(
    stage.source,
    `${ctePrefix}join_`,
    dialect,
    allowJoinSubqueryHoist,
    allowIntermediateCtes
  );
  const subqueryAst = stage.lateral
    ? ensureSelectAst(
        replaceOuterAlias(toParserSelect(compiledSubquery), baseAlias),
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
    prefix: lateralJoinPrefix(stage.lateral, dialect),
    on: exprToAst(bindFusedExpr(stage.on, scopeExprs, joinBindings, dialect)),
  };

  return {
    bindings: joinBindings,
    from: subqueryFrom,
  };
}

function fail(message: string): never {
  internalError("INTERNAL_JOIN_ALIAS_REQUIRED", message);
}
