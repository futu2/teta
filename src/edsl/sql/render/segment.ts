import type { QueryDialect } from "../types.ts";
import type { ExprNode, ScopeId, Source, SqlIdentifier, Stage } from "../../core/types.ts";
import { createColumnRefs, projectAllItems } from "../../core/expr.ts";
import { columnNamesToIdentifierMap, projectionItemsToIdentifierMap } from "../../query/utils.ts";
import type { FromAst, GroupByAst, LimitAst, OrderByAst, ScopeBindings, SelectAst, SelectColumnAst } from "./types.ts";
import { ensureAlias } from "./ast.ts";
import { bindExprScopes, exprToAst, getSqlRenderContext } from "./render.ts";
import { sourceToFrom, type CompileSourceRef, buildSqlSelectAst } from "./source.ts";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers.ts";
import { bindFusedExpr, expandProjectedColumns, type ScopeExprLookup } from "./fused.ts";
import type { StagePlanningState } from "./planner.ts";

export type CompiledSegment = {
  ast: SelectAst;
  consumed: number;
  output: StagePlanningState;
};

export function buildBaseSelectAst(
  source: Source,
  columnNames: readonly string[],
  sourceScopeId: ScopeId,
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
    baseFrom.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
  const baseBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };
  const columns = createColumnRefs<Record<string, unknown>>(sourceScopeId, columnNames);
  return buildSqlSelectAst({
    from: [from],
    columns: projectAllItems(columns, columnNames, baseFrom.columnIdentifiers).map((item) => ({
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
  from: FromAst[],
  projection: Extract<Stage, { kind: "map" | "fold" }> | null,
  orderStage: Extract<Stage, { kind: "sort" }> | null,
  limitStage: Extract<Stage, { kind: "take" }> | null,
  whereExpr: ExprNode<unknown> | null,
  havingExpr: ExprNode<unknown> | null,
  qualifyExpr: ExprNode<unknown> | null,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  currentScopeId: ScopeId,
  currentColumnNames: readonly string[],
  currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect,
  consumed = 0
): CompiledSegment {
  const columns: SelectColumnAst[] = projection
    ? projection.items.map((item) => ({
        expr: exprToAst(bindFusedExpr(item.expr, scopeExprs, currentBindings, dialect)),
        as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
      }))
    : expandProjectedColumns(currentScopeId, currentColumnNames, scopeExprs, currentBindings, dialect);
  const groupby: GroupByAst | null = projection?.kind === "fold" && projection.groupBy
    ? {
        columns: projection.groupBy.map((expr) =>
          exprToAst(bindFusedExpr(expr, scopeExprs, currentBindings, dialect))
        ),
        modifiers: [],
      }
    : null;
  const orderby: OrderByAst[] | null = orderStage
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
  const limit: LimitAst | null = limitStage
    ? {
        seperator: "",
        value: [{ type: "number", value: limitStage.count }],
      }
    : null;

  return {
    ast: buildSqlSelectAst({
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
        ? projectionItemsToIdentifierMap(projection.items)
        : currentColumnIdentifiers,
    },
  };
}

export function buildBaseFrom(source: CompileSourceRef, dialect: QueryDialect) {
  return sourceToFrom(source, dialect);
}
