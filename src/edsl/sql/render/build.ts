import type { With } from "node-sql-parser";
import type { QueryDialect } from "../types";
import type { Source, SourceRef, Stage } from "../../core/types";
import { createColumnRefs, selectAllItems } from "../../core/expr";
import type { SelectAst } from "./types";
import { ensureAlias, toParserSelect } from "./ast";
import { getDefaultDialect } from "../dialect";
import { exprToAst, qualifyForBase } from "./render";
import { buildSelectAst, hoistJoinSubquery, stageToSelect, type CompileSourceRef } from "./select";
import { compileUnionStage } from "./union";

export type BuildPipelineOptions = {
  ctePrefix?: string;
  keepTables?: Set<string>;
  dialect?: QueryDialect;
};

export function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[] | null,
  options?: BuildPipelineOptions
): { ast: SelectAst; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  const keepTables = options?.keepTables;
  const dialect = options?.dialect ?? getDefaultDialect();
  if (stages.length === 0) {
    const baseFrom: CompileSourceRef = {
      kind: "table",
      name: source.table,
      schema: source.schema,
      as: source.as,
    };
    const from = buildBaseFrom(baseFrom);
    const baseAlias = ensureAlias(from);
    const columns = createColumnRefs<Record<string, unknown>>(null, columnNames);
    return {
      ast: buildSelectAst({
        from: [from],
        columns: selectAllItems(columns, columnNames).map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: null,
        limit: null,
      }),
      ctes: [],
    };
  }

  const ctes: With[] = [];
  let current: SourceRef = {
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  };
  let unionCount = 0;

  for (let i = 0; i < stages.length - 1; i += 1) {
    const stage = hoistJoinSubquery(stages[i]!, ctes, ctePrefix, dialect);
    const stageAst =
      stage.kind === "union"
        ? compileUnionStage(
            stage,
            current,
            ctes,
            `${ctePrefix}u${unionCount}_`,
            keepTables,
            dialect
          )
        : stageToSelect(stage, current, keepTables, dialect, ctePrefix);
    if (stage.kind === "union") unionCount += 1;
    const name = `${ctePrefix}cte_${i}`;
    ctes.push({
      name: { value: name },
      stmt: {
        ast: toParserSelect(stageAst),
        tableList: [],
        columnList: [],
      },
    });
    current = { kind: "cte", name };
  }

  const finalStage = hoistJoinSubquery(stages[stages.length - 1]!, ctes, ctePrefix, dialect);
  const finalAst =
    finalStage.kind === "union"
      ? compileUnionStage(
          finalStage,
          current,
          ctes,
          `${ctePrefix}u${unionCount}_`,
          keepTables,
          dialect
        )
      : stageToSelect(finalStage, current, keepTables, dialect, ctePrefix);
  return { ast: finalAst, ctes };
}

function buildBaseFrom(source: CompileSourceRef) {
  if (source.kind === "subquery") {
    return {
      expr: {
        ast: source.ast,
        tableList: [],
        columnList: [],
        parentheses: true as const,
      },
      as: source.as,
    };
  }
  if (source.kind === "cte") {
    return { db: null, table: source.name, as: null };
  }
  return {
    db: null,
    schema: source.schema,
    table: source.name,
    as: source.as,
  };
}
