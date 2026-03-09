import type { With } from "node-sql-parser";
import { generatedCteName, type GeneratedCteName, type JoinSource, type Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import type { SelectAst } from "./types";
import { toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";

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
  ctes.push({
    name: { value: cteName },
    stmt: {
      ast: toParserSelect(subqueryAst),
      tableList: [],
      columnList: [],
    },
  });

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
  dialect: QueryDialect
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
    }
  );
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}
