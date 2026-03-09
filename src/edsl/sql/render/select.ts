import type { Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ScopeBindings, SelectAst } from "./types";
import { getDefaultDialect } from "../dialect";
import type { CompileSourceRef } from "./source";
import {
  buildFilterStageAst,
  buildLimitStageAst,
  buildOrderByStageAst,
  buildSelectStageAst,
  createStageSelectContext,
} from "./select_stage";
import { buildJoinStageAst } from "./select_join";

export function stageToSelect(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: string,
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
      throw new Error("union stages must be compiled by buildPipelineAst");
    default:
      return assertNever(stage);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
