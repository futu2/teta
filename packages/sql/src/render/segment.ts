import type { QueryDialect } from "../types.ts";
import { isInternalScopeName, type ExprNode, type ScopeId, type SqlIdentifier, type Stage } from "../ir/types.ts";
import { projectionItemsToIdentifierMap } from "../ir/utils.ts";
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
  source: CompileSourceRef,
  columnNames: readonly string[],
  sourceScopeId: ScopeId,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect
): SelectAst {
  const from = buildBaseFrom(source, dialect);
  const baseAlias = ensureAlias(from);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
  const baseBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };
  return buildSqlSelectAst({
    from: [from],
    columns: columnNames.map((name) => {
      const identifier = source.columnIdentifiers[name] ?? null;
      const expr = bindExprScopes(
        { kind: "column", table: sourceScopeId, name },
        baseBindings,
        dialect
      );
      return {
        expr: exprToAst(expr),
        as: identifier?.quoted
          ? renderIdentifier(identifier, dialect, getSqlRenderContext())
          : null,
      };
    }),
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
  const fusedProjectionItems = projection
    ? projection.items.map((item, index) => {
        const boundExpr = bindFusedExpr(item.expr, scopeExprs, currentBindings, dialect);
        const outputName = projection.keys[index] ?? item.as?.name ?? null;
        return { item, boundExpr, outputName };
      })
    : null;
  const hasExpandedAliasMismatch = !!fusedProjectionItems?.some(({ item, boundExpr, outputName }) =>
    item.as === null &&
    outputName !== null &&
    item.expr.kind === "column" &&
    isInternalScopeName(item.expr.table) &&
    item.expr.name === outputName &&
    boundExpr.kind === "column" &&
    boundExpr.name !== outputName
  );
  const columns: SelectColumnAst[] = projection
    ? fusedProjectionItems!.map(({ item, boundExpr, outputName }) => {
        const alias = outputName
          ? (item.as ?? { name: outputName, quoted: false })
          : null;
        const needsAlias = !!alias && (
          item.as !== null ||
          alias.quoted ||
          (
            item.as === null &&
            item.expr.kind === "column" &&
            isInternalScopeName(item.expr.table) &&
            (
              (boundExpr.kind === "column" && boundExpr.name !== outputName) ||
              hasExpandedAliasMismatch
            )
          )
        );

        return {
          expr: exprToAst(boundExpr),
          as: needsAlias
            ? renderIdentifier(alias, dialect, getSqlRenderContext())
            : null,
        };
      })
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
