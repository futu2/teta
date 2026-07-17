import type { ScopeId, Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { getDefaultDialect } from "../dialect.ts";
import type { CompileSourceRef } from "./source.ts";
import {
  buildFilterStageAst,
  buildDistinctStageAst,
  buildProjectionStageAst,
  buildSortStageAst,
  buildTakeStageAst,
  createStageRenderContext,
} from "./stage_ast.ts";
import { buildJoinStageAst } from "./stage_join.ts";
import { buildUnnestStageAst } from "./stage_unnest.ts";
import { internalError } from "../errors.ts";

export function compileStageAst(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect = getDefaultDialect(),
  ctePrefix = "",
  allowJoinSubqueryHoist = true,
  allowIntermediateCtes = true
): SelectAst {
  const context = createStageRenderContext(
    source,
    sourceScopeId,
    inheritedBindings,
    dialect
  );

  switch (stage.kind) {
    case "map":
    case "fold":
      return buildProjectionStageAst(stage, context);
    case "filter":
      return buildFilterStageAst(stage, context);
    case "sort":
      return buildSortStageAst(stage, context);
    case "distinct":
      return buildDistinctStageAst(stage, context);
    case "take":
      return buildTakeStageAst(stage, context);
    case "join":
      return buildJoinStageAst(
        stage,
        context,
        ctePrefix,
        allowJoinSubqueryHoist,
        allowIntermediateCtes
      );
    case "unnest":
      return buildUnnestStageAst(stage, context);
    case "union":
      internalError("INTERNAL_UNION_STAGE_ROUTING", "union stages must be compiled by buildPipelineAst");
    default:
      return assertNever(stage);
  }
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
