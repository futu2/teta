import type { ScopeId, SelectItem, Stage } from "../../core/types.ts";
import type { QueryDialect } from "../types.ts";
import type { FromAst, GroupByAst, ScopeBindings, SelectAst, SelectColumnAst } from "./types.ts";
import { ensureAlias } from "./ast.ts";
import {
  getSqlRenderContext,
  bindExprScopes,
  exprToAst,
} from "./render.ts";
import {
  registerColumnIdentifierBindings,
  renderIdentifier,
} from "./identifiers.ts";
import {
  buildSelectAst,
  sourceToFrom,
  type CompileSourceRef,
} from "./source.ts";

export type StageSelectContext = {
  baseFrom: FromAst;
  baseAlias: string;
  baseBindings: ScopeBindings;
  dialect: QueryDialect;
};

export function createStageSelectContext(
  source: CompileSourceRef,
  sourceScopeId: ScopeId,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect
): StageSelectContext {
  const baseFrom = sourceToFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerSourceColumnBindings(source, baseAlias, dialect);
  return {
    baseFrom,
    baseAlias,
    baseBindings: {
      ...(inheritedBindings ?? {}),
      [sourceScopeId]: baseAlias,
    },
    dialect,
  };
}

export function buildSelectStageAst(
  stage: Extract<Stage, { kind: "select" }>,
  context: StageSelectContext
): SelectAst {
  return buildSelectAst({
    from: [context.baseFrom],
    columns: renderBoundSelectItems(stage.items, context.baseBindings, context.dialect),
    where: null,
    groupby: stage.groupBy
      ? ({
          columns: stage.groupBy.map((expr) =>
            exprToAst(bindExprScopes(expr, context.baseBindings, context.dialect))
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
  context: StageSelectContext
): SelectAst {
  return buildSelectAst({
    from: [context.baseFrom],
    columns: renderBoundSelectItems(
      stage.selectAll,
      context.baseBindings,
      context.dialect
    ),
    where: exprToAst(bindExprScopes(stage.predicate, context.baseBindings, context.dialect)),
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

export function buildOrderByStageAst(
  stage: Extract<Stage, { kind: "orderBy" }>,
  context: StageSelectContext
): SelectAst {
  return buildSelectAst({
    from: [context.baseFrom],
    columns: renderBoundSelectItems(
      stage.selectAll,
      context.baseBindings,
      context.dialect
    ),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: stage.items.map((item) => ({
      expr: exprToAst(bindExprScopes(item.expr, context.baseBindings, context.dialect)),
      type: item.direction,
    })),
    limit: null,
  });
}

export function buildLimitStageAst(
  stage: Extract<Stage, { kind: "limit" }>,
  context: StageSelectContext
): SelectAst {
  return buildSelectAst({
    from: [context.baseFrom],
    columns: renderBoundSelectItems(
      stage.selectAll,
      context.baseBindings,
      context.dialect
    ),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: {
      seperator: "",
      value: [{ type: "number", value: stage.count }],
    },
  });
}

export function renderBoundSelectItems(
  items: SelectItem[],
  bindings: ScopeBindings,
  dialect: QueryDialect
): SelectColumnAst[] {
  const renderContext = getSqlRenderContext();
  return items.map((item) => ({
    expr: exprToAst(bindExprScopes(item.expr, bindings, dialect)),
    as: renderIdentifier(item.as, dialect, renderContext),
  }));
}

function registerSourceColumnBindings(
  source: CompileSourceRef,
  tableAlias: string,
  dialect: QueryDialect
): void {
  registerColumnIdentifierBindings(
    tableAlias,
    source.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
}
