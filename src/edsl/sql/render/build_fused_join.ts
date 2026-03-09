import type { QueryDialect } from "../types";
import type { Stage } from "../../core/types";
import type { ScopeBindings } from "./types";
import { ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast";
import { exprToAst, getSqlRenderContext, lateralJoinPrefix } from "./render";
import { buildTableFromRef, compileJoinSource } from "./source";
import { registerColumnIdentifierBindings } from "./identifiers";
import { bindFusedExpr, type ScopeExprLookup } from "./fused";

export type FusedJoinFrom = {
  from: unknown;
  bindings: ScopeBindings;
};

export function buildFusedJoinFrom(
  stage: Extract<Stage, { kind: "join" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  baseAlias: string,
  ctePrefix: string,
  dialect: QueryDialect
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
      ? stage.source.columnIdentifiers ?? null
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

  const compiledSubquery = compileJoinSource(stage.source, `${ctePrefix}join_`, dialect);
  const subqueryAst = stage.lateral
    ? ensureSelectAst(
        replaceOuterAlias(toParserSelect(compiledSubquery), baseAlias),
        "lateral join"
      )
    : compiledSubquery;

  return {
    bindings: joinBindings,
    from: {
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
    },
  };
}

function fail(message: string): never {
  throw new Error(message);
}
