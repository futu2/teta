import type { With } from "node-sql-parser";
import type { QueryDialect } from "../types";
import type { Source, Stage } from "../../core/types";
import { columnNamesToIdentifierMap } from "../../query/utils";
import type { ScopeBindings, SelectAst } from "./types";
import { toParserSelect } from "./ast";
import { getDefaultDialect } from "../dialect";
import { hoistJoinSubquery, type CompileSourceRef } from "./source";
import {
  advanceStagePlanningState,
  nextStageColumnIdentifiers,
  type StagePlanningState,
} from "./planner";
import { buildBaseSelectAst } from "./segment";
import {
  compileSingleStageAst,
  tryBuildFusedSegmentAst,
  type FusedBuildOptions,
} from "./build_fused";

export type BuildPipelineOptions = {
  ctePrefix?: string;
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
};

export function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[] | null,
  sourceScopeId: string,
  options?: BuildPipelineOptions
): { ast: SelectAst; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  const scopeBindings = options?.scopeBindings;
  const dialect = options?.dialect ?? getDefaultDialect();

  if (stages.length === 0) {
    return {
      ast: buildBaseSelectAst(source, columnNames, sourceScopeId, scopeBindings, dialect),
      ctes: [],
    };
  }

  const columnIdentifiers = columnNamesToIdentifierMap(columnNames);
  const ctes: With[] = [];
  const fusedOptions: FusedBuildOptions = {
    ctes,
    ctePrefix,
    inheritedBindings: scopeBindings,
    dialect,
  };
  let current: CompileSourceRef = {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers,
  };
  let currentPlan: StagePlanningState = {
    scopeId: sourceScopeId,
    columnNames,
    columnIdentifiers,
  };

  for (let index = 0; index < stages.length; ) {
    const fused = tryBuildFusedSegmentAst(
      current,
      currentPlan.scopeId,
      currentPlan.columnNames,
      currentPlan.columnIdentifiers,
      stages.slice(index),
      fusedOptions
    );

    if (fused) {
      index += fused.consumed;
      if (index >= stages.length) {
        return { ast: fused.ast, ctes };
      }
      current = {
        kind: "cte",
        name: appendIntermediateCte(ctes, ctePrefix, index - 1, fused.ast),
        columnIdentifiers: fused.output.columnIdentifiers,
      };
      currentPlan = fused.output;
      continue;
    }

    const stage = hoistJoinSubquery(stages[index]!, ctes, ctePrefix, dialect);
    const stageAst = compileSingleStageAst(stage, current, currentPlan.scopeId, fusedOptions);
    index += 1;
    if (index >= stages.length) {
      return { ast: stageAst, ctes };
    }
    current = {
      kind: "cte",
      name: appendIntermediateCte(ctes, ctePrefix, index - 1, stageAst),
      columnIdentifiers: nextStageColumnIdentifiers(stage, currentPlan.columnIdentifiers),
    };
    currentPlan = advanceStagePlanningState(stage, currentPlan);
  }

  throw new Error("Internal error: buildPipelineAst did not produce a final AST");
}

function appendIntermediateCte(
  ctes: With[],
  ctePrefix: string,
  stageIndex: number,
  ast: SelectAst
): string {
  const name = `${ctePrefix}cte_${stageIndex}`;
  ctes.push({
    name: { value: name },
    stmt: {
      ast: toParserSelect(ast),
      tableList: [],
      columnList: [],
    },
  });
  return name;
}
