import type { With } from "node-sql-parser";
import { generatedCteName, type GeneratedCteName, type JoinSource, type Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { SelectAst } from "./types.ts";
import { buildPipelineAst } from "./build.ts";
import { buildNamedCte } from "./cte.ts";
import { getDefaultDialect } from "../dialect.ts";

export function hoistJoinSubquery(
  stage: Stage,
  ctes: With[],
  ctePrefix: string,
  dialect: QueryDialect = getDefaultDialect()
): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  if (stage.lateral) return stage;

  const subqueryAst = compileJoinSource(
    stage.source,
    `${ctePrefix}join_${ctes.length}_`,
    dialect
  );
  if (subqueryAst.with && subqueryAst.with.length) {
    ctes.push(...subqueryAst.with);
    subqueryAst.with = null;
  }

  const cteName: GeneratedCteName = generatedCteName(ctePrefix, "join", ctes.length);
  ctes.push(buildNamedCte(cteName, subqueryAst, stage.source.query.columnNames));

  return {
    ...stage,
    source: {
      kind: "table",
      db: null,
      table: { name: cteName, quoted: false },
      schema: null,
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
  allowIntermediateCtes = true
): SelectAst {
  const compiled = buildPipelineAst(
    source.query.source,
    source.query.stages,
    source.query.columnNames,
    source.query.scopeId,
    {
      ctePrefix,
      scopeBindings: source.inheritedBindings ?? undefined,
      dialect,
      allowJoinSubqueryHoist,
      allowIntermediateCtes,
    }
  );
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}
