import type { QueryDialect } from "../types";
import type { ExprNode, Source, SqlIdentifier, Stage } from "../../core/types";
import { createColumnRefs, selectAllItems } from "../../core/expr";
import { columnNamesToIdentifierMap, selectItemsToIdentifierMap } from "../../query/utils";
import type { ScopeBindings, SelectAst } from "./types";
import { ensureAlias } from "./ast";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render";
import { sourceToFrom, type CompileSourceRef, buildSelectAst } from "./source";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers";
import { bindFusedExpr, selectExpandedColumns, type ScopeExprLookup } from "./fused";
import type { StagePlanningState } from "./planner";

export type CompiledSegment = {
  ast: SelectAst;
  consumed: number;
  output: StagePlanningState;
};

export function buildBaseSelectAst(
  source: Source,
  columnNames: readonly string[] | null,
  sourceScopeId: string,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect
): SelectAst {
  const baseFrom: CompileSourceRef = {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers: columnNamesToIdentifierMap(columnNames),
  };
  const from = buildBaseFrom(baseFrom, dialect);
  const baseAlias = ensureAlias(from);
  registerColumnIdentifierBindings(
    baseAlias,
    baseFrom.columnIdentifiers ?? null,
    dialect,
    getSqlRenderContext()
  );
  const baseBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };
  const columns = createColumnRefs<Record<string, unknown>>(sourceScopeId, columnNames);
  return buildSelectAst({
    from: [from],
    columns: selectAllItems(columns, columnNames).map((item) => ({
      expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
      as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
    })),
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
  });
}

export function buildCompiledSegment(
  from: unknown[],
  projection: Extract<Stage, { kind: "select" }> | null,
  orderStage: Extract<Stage, { kind: "orderBy" }> | null,
  limitStage: Extract<Stage, { kind: "limit" }> | null,
  whereExpr: ExprNode<unknown> | null,
  havingExpr: ExprNode<unknown> | null,
  qualifyExpr: ExprNode<unknown> | null,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  currentScopeId: string,
  currentColumnNames: readonly string[] | null,
  currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null,
  dialect: QueryDialect,
  consumed = 0
): CompiledSegment {
  const columns = projection
    ? projection.items.map((item) => ({
        expr: exprToAst(bindFusedExpr(item.expr, scopeExprs, currentBindings, dialect)),
        as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
      }))
    : selectExpandedColumns(currentScopeId, currentColumnNames, scopeExprs, currentBindings, dialect);
  const groupby = projection?.groupBy
    ? {
        columns: projection.groupBy.map((expr) =>
          exprToAst(bindFusedExpr(expr, scopeExprs, currentBindings, dialect))
        ),
        modifiers: [],
      }
    : null;
  const orderby = orderStage
    ? orderStage.items.map((item) => ({
        expr: exprToAst(
          projection
            ? bindExprScopes(
                item.expr,
                { [projection.outputScopeId]: null },
                dialect
              )
            : bindFusedExpr(item.expr, scopeExprs, currentBindings, dialect)
        ),
        type: item.direction,
      }))
    : null;
  const limit = limitStage
    ? {
        seperator: "",
        value: [{ type: "number", value: limitStage.count }],
      }
    : null;

  return {
    ast: buildSelectAst({
      from,
      columns,
      where: whereExpr ? exprToAst(whereExpr) : null,
      groupby,
      having: havingExpr ? exprToAst(havingExpr) : null,
      qualify: qualifyExpr ? exprToAst(qualifyExpr) : null,
      orderby,
      limit,
    }),
    consumed,
    output: {
      scopeId: projection?.outputScopeId ?? currentScopeId,
      columnNames: projection?.keys ?? currentColumnNames,
      columnIdentifiers: projection
        ? selectItemsToIdentifierMap(projection.items)
        : currentColumnIdentifiers,
    },
  };
}

export function buildBaseFrom(source: CompileSourceRef, dialect: QueryDialect) {
  return sourceToFrom(source, dialect);
}
