import type { With } from "node-sql-parser";
import { generatedCteName, type GeneratedCteName, type JoinSource, type Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { SelectAst, SqlRenderContext } from "./types.ts";
import { buildPipelineAst } from "./build.ts";
import { buildNamedCte } from "./cte.ts";
import { getDefaultDialect } from "../dialect.ts";
import { createAstRenderContext } from "./render_context.ts";

export function hoistJoinSubquery(
  stage: Stage,
  ctes: With[],
  ctePrefix: string,
  dialect: QueryDialect = getDefaultDialect(),
  renderContext: SqlRenderContext = createAstRenderContext(dialect)
): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  if (stage.lateral) return stage;

  const subqueryAst = compileJoinSource(
    stage.source,
    `${ctePrefix}derived_${ctes.length}_`,
    dialect,
    true,
    true,
    renderContext
  );
  if (subqueryAst.with && subqueryAst.with.length) {
    ctes.push(...subqueryAst.with);
    subqueryAst.with = null;
  }

  const cteName: GeneratedCteName = generatedCteName(ctePrefix, "derived", ctes.length);
  ctes.push(buildNamedCte(
    cteName,
    subqueryAst,
    stage.source.query.columnNames,
    {
      columnIdentifiers: stage.source.query.columnIdentifiers,
      dialect,
      renderContext,
    }
  ));

  return {
    ...stage,
    source: {
      kind: "cte",
      name: cteName,
      columnIdentifiers: stage.source.query.columnIdentifiers,
    },
    as: stage.as,
  };
}

export function compileJoinSource(
  source: JoinSource & { kind: "subquery" },
  ctePrefix: string,
  dialect: QueryDialect,
  allowJoinSubqueryHoist = true,
  allowIntermediateCtes = true,
  renderContext: SqlRenderContext = createAstRenderContext(dialect)
): SelectAst {
  const compiled = buildPipelineAst(
    source.query.source,
    source.query.stages,
    source.query.columnNames,
    source.query.scopeId,
    {
      ctePrefix,
      columnIdentifiers: source.query.columnIdentifiers,
      scopeBindings: source.inheritedBindings ?? undefined,
      dialect,
      allowJoinSubqueryHoist,
      allowIntermediateCtes,
      renderContext,
    }
  );
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}
