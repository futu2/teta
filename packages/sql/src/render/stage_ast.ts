import type { ScopeId, ProjectionItem, Stage } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import { createDictionary } from "../dictionary.ts";
import type { FromAst, GroupByAst, ScopeBindings, SelectAst, SelectColumnAst, SqlRenderContext } from "./types.ts";
import { ensureAlias } from "./ast.ts";
import {
  bindExprScopes,
  exprToAst,
} from "./render.ts";
import {
  registerColumnIdentifierBindings,
  renderIdentifier,
} from "./identifiers.ts";
import {
  buildSqlSelectAst,
  sourceToFrom,
  type CompileSourceRef,
} from "./source.ts";
import { applyTake } from "./take.ts";

export type StageRenderContext = {
  baseFrom: FromAst;
  baseAlias: string;
  baseBindings: ScopeBindings;
  dialect: QueryDialect;
  renderContext: SqlRenderContext;
};

export function createStageRenderContext(
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): StageRenderContext {
  const baseFrom = sourceToFrom(source, dialect, renderContext);
  const baseAlias = ensureAlias(baseFrom);
  registerSourceColumnBindings(source, baseAlias, dialect, renderContext);
  const baseBindings = createDictionary<string | null>(inheritedBindings);
  baseBindings[sourceScopeId] = baseAlias;
  return {
    baseFrom,
    baseAlias,
    baseBindings,
    dialect,
    renderContext,
  };
}

export function buildProjectionStageAst(
  stage: Extract<Stage, { kind: "map" | "fold" }>,
  context: StageRenderContext
): SelectAst {
  return buildSqlSelectAst({
    from: [context.baseFrom],
    columns: renderBoundProjectionItems(
      stage.items,
      context.baseBindings,
      context.dialect,
      context.renderContext
    ),
    where: null,
    groupby: stage.kind === "fold" && stage.groupBy
      ? ({
          columns: stage.groupBy.map((expr) =>
            exprToAst(
              bindExprScopes(expr, context.baseBindings, context.dialect),
              context.renderContext
            )
          ),
          modifiers: [],
        } satisfies GroupByAst)
      : null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

export function buildFilterStageAst(
  stage: Extract<Stage, { kind: "filter" }>,
  context: StageRenderContext
): SelectAst {
  return buildSqlSelectAst({
    from: [context.baseFrom],
    columns: renderBoundProjectionItems(
      stage.projectAll,
      context.baseBindings,
      context.dialect,
      context.renderContext
    ),
    where: exprToAst(
      bindExprScopes(stage.predicate, context.baseBindings, context.dialect),
      context.renderContext
    ),
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

export function buildSortStageAst(
  stage: Extract<Stage, { kind: "sort" }>,
  context: StageRenderContext
): SelectAst {
  return buildSqlSelectAst({
    from: [context.baseFrom],
    columns: renderBoundProjectionItems(
      stage.projectAll,
      context.baseBindings,
      context.dialect,
      context.renderContext
    ),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: stage.items.map((item) => ({
      expr: exprToAst(
        bindExprScopes(item.expr, context.baseBindings, context.dialect),
        context.renderContext
      ),
      type: item.direction,
    })),
    limit: null,
  });
}

export function buildTakeStageAst(
  stage: Extract<Stage, { kind: "take" }>,
  context: StageRenderContext
): SelectAst {
  const ast = buildSqlSelectAst({
    from: [context.baseFrom],
    columns: renderBoundProjectionItems(
      stage.projectAll,
      context.baseBindings,
      context.dialect,
      context.renderContext
    ),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
  return applyTake(ast, stage.count, context.dialect);
}

export function buildDistinctStageAst(
  stage: Extract<Stage, { kind: "distinct" }>,
  context: StageRenderContext
): SelectAst {
  return buildSqlSelectAst({
    from: [context.baseFrom],
    columns: renderBoundProjectionItems(
      stage.projectAll,
      context.baseBindings,
      context.dialect,
      context.renderContext
    ),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
    distinct: true,
  });
}

export function renderBoundProjectionItems(
  items: readonly ProjectionItem[],
  bindings: ScopeBindings,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): SelectColumnAst[] {
  return items.map((item) => ({
    expr: exprToAst(bindExprScopes(item.expr, bindings, dialect), renderContext),
    as: renderIdentifier(item.as, dialect, renderContext),
  }));
}

function registerSourceColumnBindings(
  source: CompileSourceRef,
  tableAlias: string,
  dialect: QueryDialect,
  renderContext: SqlRenderContext
): void {
  registerColumnIdentifierBindings(
    tableAlias,
    source.columnIdentifiers,
    dialect,
    renderContext
  );
}
