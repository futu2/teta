import type { ScopeId, Stage } from "../../core/types.ts";
import type { QueryDialect } from "../types.ts";
import type { ScopeBindings, SelectAst } from "./types.ts";
import { getDefaultDialect } from "../dialect.ts";
import type { CompileSourceRef } from "./source.ts";
import {
  buildFilterStageAst,
  buildLimitStageAst,
  buildOrderByStageAst,
  buildSelectStageAst,
  createStageSelectContext,
} from "./select_stage.ts";
import { buildJoinStageAst } from "./select_join.ts";
import { internalError } from "../../errors.ts";

export function stageToSelect(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect = getDefaultDialect(),
  ctePrefix = ""
): SelectAst {
  const context = createStageSelectContext(
    source,
    sourceScopeId,
    inheritedBindings,
    dialect
  );

  switch (stage.kind) {
    case "select":
      return buildSelectStageAst(stage, context);
    case "filter":
      return buildFilterStageAst(stage, context);
    case "orderBy":
      return buildOrderByStageAst(stage, context);
    case "limit":
      return buildLimitStageAst(stage, context);
    case "join":
      return buildJoinStageAst(stage, context, ctePrefix);
    case "union":
      internalError("INTERNAL_UNION_STAGE_ROUTING", "union stages must be compiled by buildPipelineAst");
    default:
      return assertNever(stage);
  }
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
