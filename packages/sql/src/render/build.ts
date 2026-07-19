import type { With } from "node-sql-parser";
import { createDictionary } from "../dictionary.ts";
import type { QueryDialect, SqlRenderStrategy } from "../types.ts";
import { generatedCteName, isValuesSource, type GeneratedCteName, type ScopeId, type Source, type SqlIdentifier, type Stage } from "../ir/types.ts";
import { columnNamesToIdentifierMap } from "../ir/utils.ts";
import type { ScopeBindings, SelectAst, SqlRenderContext } from "./types.ts";
import { buildNamedCte } from "./cte.ts";
import { getDefaultDialect } from "../dialect.ts";
import { compileSourceRef, hoistJoinSubquery, type CompileSourceRef } from "./source.ts";
import {
  advanceStagePlanningState,
  type StagePlanningState,
} from "./planner.ts";
import { buildBaseSelectAst } from "./segment.ts";
import { internalError } from "../errors.ts";
import {
  compileSingleStageAst,
  tryBuildFusedSegmentAst,
  type FusedBuildOptions,
} from "./build_fused.ts";
import { createAstRenderContext } from "./render_context.ts";

export type BuildPipelineOptions = {
  ctePrefix?: string;
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
  renderStrategy?: SqlRenderStrategy;
  allowJoinSubqueryHoist?: boolean;
  allowIntermediateCtes?: boolean;
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  renderContext?: SqlRenderContext;
};

export function buildPipelineAst(
  source: Source,
  stages: readonly Stage[],
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
  const inputColumnNames = isValuesSource(source) && source.rows.length > 0
    ? Object.keys(source.rows[0]!)
    : initialStageColumnNames(stages[0], columnNames);
  const finalColumnIdentifiers = options?.columnIdentifiers
    ? createDictionary(options.columnIdentifiers)
    : columnNamesToIdentifierMap(columnNames);
  const columnIdentifiers = createDictionary({
    ...columnNamesToIdentifierMap(inputColumnNames),
    ...finalColumnIdentifiers,
  });
  const renderContext = options?.renderContext ?? createAstRenderContext(dialect);
  const baseSource = compileSourceRef(source, columnIdentifiers, dialect, renderContext);

  if (stages.length === 0) {
    return {
      ast: buildBaseSelectAst(baseSource, inputColumnNames, sourceScopeId, scopeBindings, dialect, renderContext),
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
    renderContext,
  };
  let current: CompileSourceRef = baseSource;
  let currentPlan: StagePlanningState = {
    scopeId: sourceScopeId,
    columnNames: inputColumnNames,
    columnIdentifiers,
  };

  for (let index = 0; index < stages.length; ) {
    if (renderStrategy === "readable") {
      const rawStage = stages[index]!;
      const stage = allowJoinSubqueryHoist
        ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect, renderContext)
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
        dialect,
        allowIntermediateCtes,
        renderContext
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
        dialect,
        allowIntermediateCtes,
        renderContext
      );
      currentPlan = fused.output;
      continue;
    }

    const rawStage = stages[index]!;
    const stage = allowJoinSubqueryHoist
      ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect, renderContext)
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
      dialect,
      allowIntermediateCtes,
      renderContext
    );
    currentPlan = nextPlan;
  }

  internalError("INTERNAL_BUILD_PIPELINE_FAILED", "Internal error: buildPipelineAst did not produce a final AST");
}

function initialStageColumnNames(
  stage: Stage | undefined,
  fallback: readonly string[]
): readonly string[] {
  if (!stage || stage.kind === "map" || stage.kind === "fold") return fallback;
  return stage.projectAll.map((item) =>
    item.as?.name ?? (item.expr.kind === "column" ? item.expr.name : ""))
    .filter((name) => name.length > 0);
}

function appendIntermediateCte(
  ctes: With[],
  ctePrefix: string,
  stageIndex: number,
  ast: SelectAst,
  columnNames: readonly string[],
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): GeneratedCteName {
  const name = generatedCteName(ctePrefix, "stage", stageIndex);
  ctes.push(buildNamedCte(name, ast, columnNames, { columnIdentifiers, dialect, renderContext }));
  return name;
}

function buildIntermediateSourceRef(
  ctes: With[],
  ctePrefix: string,
  stageIndex: number,
  ast: SelectAst,
  columnNames: readonly string[],
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect,
  allowIntermediateCtes: boolean,
  renderContext: SqlRenderContext
): CompileSourceRef {
  if (!allowIntermediateCtes) {
    return {
      kind: "subquery",
      ast,
      as: generatedCteName(ctePrefix, "derived", stageIndex),
      columnIdentifiers,
    };
  }

  return {
    kind: "cte",
    name: appendIntermediateCte(
      ctes,
      ctePrefix,
      stageIndex,
      ast,
      columnNames,
      columnIdentifiers,
      dialect,
      renderContext
    ),
    columnIdentifiers,
  };
}
