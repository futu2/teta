import type { With } from "node-sql-parser";
import type { QueryDialect, SqlRenderStrategy } from "../types.ts";
import { generatedCteName, type GeneratedCteName, type ScopeId, type Source, type SqlIdentifier, type Stage } from "../../core/types.ts";
import { columnNamesToIdentifierMap } from "../../query/utils.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { buildNamedCte } from "./cte.ts";
import { getDefaultDialect } from "../dialect.ts";
import { compileSourceRef, hoistJoinSubquery, type CompileSourceRef } from "./source.ts";
import {
  advanceStagePlanningState,
  type StagePlanningState,
} from "./planner.ts";
import { buildBaseSelectAst } from "./segment.ts";
import { internalError } from "../../errors.ts";
import {
  compileSingleStageAst,
  tryBuildFusedSegmentAst,
  type FusedBuildOptions,
} from "./build_fused.ts";

export type BuildPipelineOptions = {
  ctePrefix?: string;
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
  renderStrategy?: SqlRenderStrategy;
  allowJoinSubqueryHoist?: boolean;
  allowIntermediateCtes?: boolean;
};

export function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[],
  sourceScopeId: ScopeId,
  options?: BuildPipelineOptions
): { ast: SelectAst; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  const scopeBindings = options?.scopeBindings;
  const dialect = options?.dialect ?? getDefaultDialect();
  const renderStrategy = options?.renderStrategy ?? "optimized";
  const allowJoinSubqueryHoist = options?.allowJoinSubqueryHoist ?? true;
  const allowIntermediateCtes = options?.allowIntermediateCtes ?? true;
  const columnIdentifiers = columnNamesToIdentifierMap(columnNames);
  const baseSource = compileSourceRef(source, columnIdentifiers, dialect);

  if (stages.length === 0) {
    return {
      ast: buildBaseSelectAst(baseSource, columnNames, sourceScopeId, scopeBindings, dialect),
      ctes: [],
    };
  }

  const ctes: With[] = [];
  const fusedOptions: FusedBuildOptions = {
    ctes,
    ctePrefix,
    inheritedBindings: scopeBindings,
    dialect,
    allowJoinSubqueryHoist,
    allowIntermediateCtes,
  };
  let current: CompileSourceRef = baseSource;
  let currentPlan: StagePlanningState = {
    scopeId: sourceScopeId,
    columnNames,
    columnIdentifiers,
  };

  for (let index = 0; index < stages.length; ) {
    if (renderStrategy === "readable") {
      const rawStage = stages[index]!;
      const stage = allowJoinSubqueryHoist
        ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect)
        : rawStage;
      const stageAst = compileSingleStageAst(stage, current, currentPlan.scopeId, fusedOptions);
      index += 1;
      if (index >= stages.length) {
        return { ast: stageAst, ctes };
      }
      const nextPlan = advanceStagePlanningState(stage, currentPlan);
      current = buildIntermediateSourceRef(
        ctes,
        ctePrefix,
        index - 1,
        stageAst,
        nextPlan.columnNames,
        nextPlan.columnIdentifiers,
        allowIntermediateCtes
      );
      currentPlan = nextPlan;
      continue;
    }

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
      current = buildIntermediateSourceRef(
        ctes,
        ctePrefix,
        index - 1,
        fused.ast,
        fused.output.columnNames,
        fused.output.columnIdentifiers,
        allowIntermediateCtes
      );
      currentPlan = fused.output;
      continue;
    }

    const rawStage = stages[index]!;
    const stage = allowJoinSubqueryHoist
      ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect)
      : rawStage;
    const stageAst = compileSingleStageAst(stage, current, currentPlan.scopeId, fusedOptions);
    index += 1;
    if (index >= stages.length) {
      return { ast: stageAst, ctes };
    }
    const nextPlan = advanceStagePlanningState(stage, currentPlan);
    current = buildIntermediateSourceRef(
      ctes,
      ctePrefix,
      index - 1,
      stageAst,
      nextPlan.columnNames,
      nextPlan.columnIdentifiers,
      allowIntermediateCtes
    );
    currentPlan = nextPlan;
  }

  internalError("INTERNAL_BUILD_PIPELINE_FAILED", "Internal error: buildPipelineAst did not produce a final AST");
}

function appendIntermediateCte(
  ctes: With[],
  ctePrefix: string,
  stageIndex: number,
  ast: SelectAst,
  columnNames: readonly string[]
): GeneratedCteName {
  const name = generatedCteName(ctePrefix, "cte", stageIndex);
  ctes.push(buildNamedCte(name, ast, columnNames));
  return name;
}

function buildIntermediateSourceRef(
  ctes: With[],
  ctePrefix: string,
  stageIndex: number,
  ast: SelectAst,
  columnNames: readonly string[],
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  allowIntermediateCtes: boolean
): CompileSourceRef {
  if (!allowIntermediateCtes) {
    return {
      kind: "subquery",
      ast,
      as: generatedCteName(ctePrefix, "sq", stageIndex),
      columnIdentifiers,
    };
  }

  return {
    kind: "cte",
    name: appendIntermediateCte(ctes, ctePrefix, stageIndex, ast, columnNames),
    columnIdentifiers,
  };
}
