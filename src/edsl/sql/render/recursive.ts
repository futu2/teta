import type { With } from "node-sql-parser";
import type { CteSpec, InternalCteName, QuerySpec, SqlIdentifier } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ColumnRefAst, SelectAst } from "./types";
import { toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { getSqlRenderContext } from "./render";
import { stageToSelect } from "./select";
import type { CompileSourceRef } from "./source";
import { resolveIdentifierName } from "./identifiers";
import { attachUnion } from "./union";
import { buildBaseSelectAst } from "./segment";
import { optimizeLoopStages } from "./recursive_optimizer";
import { advanceStagePlanningState, type StagePlanningState } from "./planner";

export type RecursivePart = QuerySpec;

export function createDeferredRecursiveCte(
  name: InternalCteName,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart
): CteSpec {
  return {
    kind: "recursive",
    name,
    columnNames: [...columnNames],
    base,
    step,
  };
}

export function buildRecursiveCte(
  name: InternalCteName,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart,
  dialect: QueryDialect = getDefaultDialect()
): With {
  if (!dialect.features.recursiveCte) {
    throw new Error(`Dialect ${dialect.name} does not support recursive CTE`);
  }
  const renderedName = resolveIdentifierName(name, getSqlRenderContext());
  const baseAst = compileLoopPart(base, "base", dialect);
  const stepAst = compileLoopPart(step, "step", dialect);
  const unionAst = attachUnion(baseAst, stepAst, "union all");
  const recursiveWith: With & { recursive: boolean } = {
    name: { value: renderedName },
    stmt: {
      ast: toParserSelect(unionAst),
      tableList: [],
      columnList: [],
    },
    columns: columnNames.map(toCteColumnRef),
    recursive: true,
  };
  return recursiveWith;
}

export function materializeCte(cte: CteSpec, dialect: QueryDialect): With {
  const renderedName = resolveIdentifierName(cte.name, getSqlRenderContext());
  switch (cte.kind) {
    case "recursive":
      return buildRecursiveCte(cte.name, cte.columnNames, cte.base, cte.step, dialect);
    case "query": {
      const compiled = buildPipelineAst(
        cte.query.source,
        cte.query.stages,
        cte.query.columnNames,
        cte.query.scopeId,
        {
          ctePrefix: `${renderedName}_`,
          dialect,
        }
      );
      const ast = compiled.ast;
      ast.with = compiled.ctes.length ? compiled.ctes : null;
      return {
        name: { value: renderedName },
        stmt: {
          ast: toParserSelect(ast),
          tableList: [],
          columnList: [],
        },
      };
    }
    default:
      return assertNever(cte);
  }
}

function toCteColumnRef(name: string): ColumnRefAst {
  return {
    type: "column_ref",
    table: null,
    column: {
      expr: {
        type: "default",
        value: name,
      },
    },
    collate: null,
  };
}

export function compileLoopPart(
  input: QuerySpec,
  label: "base" | "step",
  dialect: QueryDialect
): SelectAst {
  const { source, stages, columnNames, columnIdentifiers, scopeId } = input;
  if (stages.length === 0) {
    return buildBaseSelectAst(source, columnNames, scopeId, undefined, dialect);
  }

  const optimizedStages = optimizeLoopStages(stages, columnNames, label);
  if (optimizedStages.length === 0) {
    return buildBaseSelectAst(source, columnNames, scopeId, undefined, dialect);
  }

  let current: CompileSourceRef = {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers,
  };
  let currentPlan: StagePlanningState = {
    scopeId,
    columnNames,
    columnIdentifiers,
  };
  let compiled: SelectAst | null = null;

  for (let i = 0; i < optimizedStages.length; i += 1) {
    const stage = optimizedStages[i]!;
    compiled = stageToSelect(stage, current, currentPlan.scopeId, undefined, dialect, `loop_${label}_${i}_`);
    if (i < optimizedStages.length - 1) {
      const nextPlan = advanceStagePlanningState(stage, currentPlan);
      current = {
        kind: "subquery",
        ast: compiled,
        as: `loop_${label}_${i}`,
        columnIdentifiers: nextPlan.columnIdentifiers,
      };
      currentPlan = nextPlan;
    }
  }

  if (!compiled) {
    throw new Error(`Internal error: loop ${label} did not compile`);
  }
  return compiled;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
