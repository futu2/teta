import type { With } from "node-sql-parser";
import type { QueryDialect } from "../types";
import type { ExprNode, SelectItem, Source, SourceRef, SqlIdentifier, Stage } from "../../core/types";
import { createColumnRefs, selectAllItems, shouldAlias } from "../../core/expr";
import { columnNamesToIdentifierMap, selectItemOutputName, selectItemsToIdentifierMap } from "../../query/utils";
import type { ScopeBindings, SelectAst } from "./types";
import {
  ensureAlias,
  ensureSelectAst,
  replaceOuterAlias,
  toParserSelect,
} from "./ast";
import { getDefaultDialect } from "../dialect";
import { bindExprScopes, exprToAst, getSqlRenderContext, lateralJoinPrefix } from "./render";
import { buildSelectAst, buildTableFromRef, hoistJoinSubquery, sourceToFrom, type CompileSourceRef } from "./select";
import { registerColumnIdentifierBindings, renderIdentifier } from "./identifiers";
import { compileUnionStage } from "./union";

export type BuildPipelineOptions = {
  ctePrefix?: string;
  scopeBindings?: ScopeBindings;
  dialect?: QueryDialect;
};

type ScopeExprLookup = Record<string, Record<string, ExprNode<unknown>>>;

type CompiledSegment = {
  ast: SelectAst;
  consumed: number;
  outputScopeId: string;
  outputColumnNames: readonly string[] | null;
  outputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null;
};

export function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[] | null,
  sourceScopeId: string,
  options?: BuildPipelineOptions
): { ast: SelectAst; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  const scopeBindings = options?.scopeBindings;
  const dialect = options?.dialect ?? getDefaultDialect();

  if (stages.length === 0) {
    return {
      ast: buildBaseSelectAst(source, columnNames, sourceScopeId, scopeBindings, dialect),
      ctes: [],
    };
  }

  const ctes: With[] = [];
  let current: CompileSourceRef = {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers: columnNamesToIdentifierMap(columnNames),
  };
  let currentScopeId = sourceScopeId;
  let currentColumnNames = columnNames;
  let currentColumnIdentifiers = columnNamesToIdentifierMap(columnNames);

  for (let index = 0; index < stages.length; ) {
    const remaining = stages.slice(index);
    const fused = tryBuildFusedSegmentAst(
      current,
      currentScopeId,
      currentColumnNames,
      currentColumnIdentifiers,
      remaining,
      ctes,
      ctePrefix,
      scopeBindings,
      dialect
    );

    if (fused) {
      index += fused.consumed;
      if (index >= stages.length) {
        return { ast: fused.ast, ctes };
      }
      const name = `${ctePrefix}cte_${index - 1}`;
      ctes.push({
        name: { value: name },
        stmt: {
          ast: toParserSelect(fused.ast),
          tableList: [],
          columnList: [],
        },
      });
      current = { kind: "cte", name, columnIdentifiers: fused.outputColumnIdentifiers };
      currentScopeId = fused.outputScopeId;
      currentColumnNames = fused.outputColumnNames;
      currentColumnIdentifiers = fused.outputColumnIdentifiers;
      continue;
    }

    const stage = hoistJoinSubquery(stages[index]!, ctes, ctePrefix, dialect);
    const stageAst = compileSingleStageAst(
      stage,
      current,
      currentScopeId,
      scopeBindings,
      dialect,
      ctePrefix,
      ctes
    );
    index += 1;
    if (index >= stages.length) {
      return { ast: stageAst, ctes };
    }
    const name = `${ctePrefix}cte_${index - 1}`;
    ctes.push({
      name: { value: name },
      stmt: {
        ast: toParserSelect(stageAst),
        tableList: [],
        columnList: [],
      },
    });
    current = {
      kind: "cte",
      name,
      columnIdentifiers: nextColumnIdentifiers(stage, currentColumnIdentifiers),
    };
    currentScopeId = nextScopeId(stage, currentScopeId);
    currentColumnNames = nextColumnNames(stage, currentColumnNames);
    currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
  }

  throw new Error("Internal error: buildPipelineAst did not produce a final AST");
}

function buildBaseSelectAst(
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

function tryBuildFusedSegmentAst(
  source: CompileSourceRef,
  sourceScopeId: string,
  inputColumnNames: readonly string[] | null,
  inputColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null,
  stages: Stage[],
  ctes: With[],
  ctePrefix: string,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect
): CompiledSegment | null {
  if (stages.length === 0) return null;
  if (stages[0]?.kind === "union") return null;

  const baseFrom = buildBaseFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerColumnIdentifierBindings(
    baseAlias,
    source.columnIdentifiers ?? inputColumnIdentifiers,
    dialect,
    getSqlRenderContext()
  );
  const baseBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };

  const from: unknown[] = [baseFrom];
  const scopeExprs: ScopeExprLookup = {};
  let currentBindings = baseBindings;
  let currentScopeId = sourceScopeId;
  let currentColumnNames = inputColumnNames;
  let currentColumnIdentifiers = source.columnIdentifiers ?? inputColumnIdentifiers;
  let projection: Extract<Stage, { kind: "select" }> | null = null;
  let orderStage: Extract<Stage, { kind: "orderBy" }> | null = null;
  let limitStage: Extract<Stage, { kind: "limit" }> | null = null;
  let whereExpr: ExprNode<unknown> | null = null;
  let havingExpr: ExprNode<unknown> | null = null;
  let qualifyExpr: ExprNode<unknown> | null = null;
  let phase: "preprojection" | "postprojection" | "postorder" | "postlimit" = "preprojection";
  let consumed = 0;

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const rawStage = stages[stageIndex]!;
    const stage = rawStage.kind === "join"
      ? hoistJoinSubquery(rawStage, ctes, ctePrefix, dialect)
      : rawStage;

    switch (phase) {
      case "preprojection":
        switch (stage.kind) {
          case "filter": {
            const next = bindFusedExpr(stage.predicate, scopeExprs, currentBindings, dialect);
            whereExpr = mergePredicates(whereExpr, next);
            currentColumnNames = nextColumnNames(stage, currentColumnNames);
            currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
            consumed += 1;
            continue;
          }
          case "join": {
            const nextJoin = buildFusedJoinFrom(
              stage,
              scopeExprs,
              currentBindings,
              baseAlias,
              ctePrefix,
              dialect
            );
            from.push(nextJoin.from);
            currentBindings = nextJoin.bindings;
            scopeExprs[stage.outputScopeId] = selectItemsToScopeMap(stage.selectAll);
            currentScopeId = stage.outputScopeId;
            currentColumnNames = nextColumnNames(stage, currentColumnNames);
            currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
            consumed += 1;
            continue;
          }
          case "select":
            projection = stage;
            scopeExprs[stage.outputScopeId] = selectItemsToScopeMap(stage.items);
            currentScopeId = stage.outputScopeId;
            currentColumnNames = stage.keys;
            currentColumnIdentifiers = selectItemsToIdentifierMap(stage.items);
            phase = "postprojection";
            consumed += 1;
            continue;
          case "orderBy":
            orderStage = stage;
            currentColumnNames = nextColumnNames(stage, currentColumnNames);
            currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
            phase = "postorder";
            consumed += 1;
            continue;
          case "limit":
            limitStage = stage;
            currentColumnNames = nextColumnNames(stage, currentColumnNames);
            currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
            phase = "postlimit";
            consumed += 1;
            continue;
          case "union":
            return consumed === 0 ? null : buildCompiledSegment(
              from,
              projection,
              orderStage,
              limitStage,
              whereExpr,
              havingExpr,
              qualifyExpr,
              scopeExprs,
              currentBindings,
              currentScopeId,
              currentColumnNames,
              currentColumnIdentifiers,
              dialect,
              consumed
            );
          default:
            return assertNever(stage);
        }
      case "postprojection":
        if (stage.kind === "filter") {
          const { window, nonWindow, outerWindow } = partitionWindowPredicate(
            stage.predicate,
            scopeExprs,
            currentBindings,
            dialect
          );
          const next = bindFusedExpr(stage.predicate, scopeExprs, currentBindings, dialect);
          const useHaving = projection && isAggregateProjection(projection);

          if (window) {
            if (nonWindow) {
              if (useHaving) {
                const { aggregate, nonAggregate } = partitionAggregatePredicate(nonWindow);
                if (nonAggregate) {
                  whereExpr = mergePredicates(whereExpr, nonAggregate);
                }
                if (aggregate) {
                  havingExpr = mergePredicates(havingExpr, aggregate);
                }
              } else {
                whereExpr = mergePredicates(whereExpr, nonWindow);
              }
            }
            if (!dialect.features.qualifyClause) {
              if (!projection || !outerWindow) {
                break;
              }
              const inner = buildCompiledSegment(
                from,
                projection,
                orderStage,
                limitStage,
                whereExpr,
                havingExpr,
                qualifyExpr,
                scopeExprs,
                currentBindings,
                currentScopeId,
                currentColumnNames,
                currentColumnIdentifiers,
                dialect,
                consumed
              );
              const outer = tryBuildFusedSegmentAst(
                {
                  kind: "subquery",
                  ast: inner.ast,
                  as: null,
                  columnIdentifiers: inner.outputColumnIdentifiers,
                },
                projection.outputScopeId,
                projection.keys,
                inner.outputColumnIdentifiers,
                [{ ...stage, predicate: outerWindow }, ...stages.slice(stageIndex + 1)],
                ctes,
                ctePrefix,
                inheritedBindings,
                dialect
              );
              if (!outer) {
                return inner;
              }
              return {
                ...outer,
                consumed: inner.consumed + outer.consumed,
              };
            }
            qualifyExpr = mergePredicates(qualifyExpr, window);
          } else if (useHaving) {
            const { aggregate, nonAggregate } = partitionAggregatePredicate(next);
            if (nonAggregate) {
              whereExpr = mergePredicates(whereExpr, nonAggregate);
            }
            if (aggregate) {
              havingExpr = mergePredicates(havingExpr, aggregate);
            }
          } else {
            whereExpr = mergePredicates(whereExpr, next);
          }
          currentColumnNames = nextColumnNames(stage, currentColumnNames);
          currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
          consumed += 1;
          continue;
        }



        if (stage.kind === "orderBy" && !orderStage) {
          orderStage = stage;
          currentColumnNames = nextColumnNames(stage, currentColumnNames);
          currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
          phase = "postorder";
          consumed += 1;
          continue;
        }
        if (stage.kind === "limit" && !limitStage) {
          limitStage = stage;
          currentColumnNames = nextColumnNames(stage, currentColumnNames);
          currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
          phase = "postlimit";
          consumed += 1;
          continue;
        }
        break;
      case "postorder":
        if (stage.kind === "limit" && !limitStage) {
          limitStage = stage;
          currentColumnNames = nextColumnNames(stage, currentColumnNames);
          currentColumnIdentifiers = nextColumnIdentifiers(stage, currentColumnIdentifiers);
          phase = "postlimit";
          consumed += 1;
          continue;
        }
        break;
      case "postlimit":
        break;
      default:
        return assertNever(phase);
    }

    break;
  }

  if (consumed === 0) return null;
  return buildCompiledSegment(
    from,
    projection,
    orderStage,
    limitStage,
    whereExpr,
    havingExpr,
    qualifyExpr,
    scopeExprs,
    currentBindings,
    currentScopeId,
    currentColumnNames,
    currentColumnIdentifiers,
    dialect,
    consumed
  );
}

function buildCompiledSegment(
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
    outputScopeId: projection?.outputScopeId ?? currentScopeId,
    outputColumnNames: projection?.keys ?? currentColumnNames,
    outputColumnIdentifiers: projection
      ? selectItemsToIdentifierMap(projection.items)
      : currentColumnIdentifiers,
  };
}

function compileSingleStageAst(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: string,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect,
  ctePrefix: string,
  ctes: With[]
): SelectAst {
  if (stage.kind === "union") {
    return compileUnionStage(
      stage,
      source,
      sourceScopeId,
      ctes,
      `${ctePrefix}u0_`,
      inheritedBindings,
      dialect
    );
  }

  const compiled = tryBuildFusedSegmentAst(
    source,
    sourceScopeId,
    nextColumnNames(stage, null),
    nextColumnIdentifiers(stage, source.columnIdentifiers ?? null),
    [stage],
    ctes,
    ctePrefix,
    inheritedBindings,
    dialect
  );
  if (!compiled) {
    throw new Error(`Internal error: failed to compile stage ${stage.kind}`);
  }
  return compiled.ast;
}

function buildFusedJoinFrom(
  stage: Extract<Stage, { kind: "join" }>,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  baseAlias: string,
  ctePrefix: string,
  dialect: QueryDialect
): { from: unknown; bindings: ScopeBindings } {
  const alias = stage.as ?? fail("Join stage requires an alias");
  const joinBindings: ScopeBindings = {
    ...currentBindings,
    [stage.rightScopeId]: alias,
  };
  const join = `${stage.joinType} JOIN`;
  registerColumnIdentifierBindings(
    alias,
    stage.source.kind === "table"
      ? stage.source.columnIdentifiers ?? null
      : stage.source.query.columnIdentifiers,
    dialect,
    getSqlRenderContext()
  );

  if (stage.source.kind === "table") {
    return {
      bindings: joinBindings,
      from: {
        ...buildTableFromRef({
          db: stage.source.db,
          schema: stage.source.schema,
          table: stage.source.table,
          alias: stage.as,
        }, dialect),
        join,
        prefix: lateralJoinPrefix(stage.lateral, dialect),
        on: exprToAst(bindFusedExpr(stage.on, scopeExprs, joinBindings, dialect)),
      },
    };
  }

  const compiledSubquery = compileJoinSubquery(stage.source, `${ctePrefix}join_`, dialect);
  const subqueryAst = stage.lateral
    ? ensureSelectAst(
        replaceOuterAlias(toParserSelect(compiledSubquery), baseAlias),
        "lateral join"
      )
    : compiledSubquery;

  return {
    bindings: joinBindings,
    from: {
      expr: {
        ast: subqueryAst,
        tableList: [],
        columnList: [],
        parentheses: true,
      },
      as: stage.as,
      join,
      prefix: lateralJoinPrefix(stage.lateral, dialect),
      on: exprToAst(bindFusedExpr(stage.on, scopeExprs, joinBindings, dialect)),
    },
  };
}

function compileJoinSubquery(
  source: Extract<Stage, { kind: "join" }>['source'] & { kind: "subquery" },
  ctePrefix: string,
  dialect: QueryDialect
): SelectAst {
  const compiled = buildPipelineAst(
    source.query.source,
    source.query.stages,
    source.query.columnNames,
    source.query.scopeId,
    {
      ctePrefix,
      scopeBindings: source.inheritedBindings ?? undefined,
      dialect,
    }
  );
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}

function bindFusedExpr(
  expr: ExprNode<unknown>,
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): ExprNode<unknown> {
  return bindExprScopes(expandScopeExprs(expr, scopeExprs), bindings, dialect);
}

function expandScopeExprs(
  expr: ExprNode<unknown>,
  scopeExprs: ScopeExprLookup
): ExprNode<unknown> {
  switch (expr.kind) {
    case "column": {
      if (!expr.table) return expr;
      const mapping = scopeExprs[expr.table];
      if (!mapping) return expr;
      const expanded = mapping[expr.name];
      if (!expanded) {
        throw new Error(`Missing fused scope mapping for ${expr.table}.${expr.name}`);
      }
      return expandScopeExprs(expanded, scopeExprs);
    }
    case "binary":
      return {
        ...expr,
        left: expandScopeExprs(expr.left, scopeExprs),
        right: expandScopeExprs(expr.right, scopeExprs),
      };
    case "unary":
      return { ...expr, expr: expandScopeExprs(expr.expr, scopeExprs) };
    case "agg":
      return { ...expr, arg: expandScopeExprs(expr.arg, scopeExprs) };
    case "group":
      return { ...expr, expr: expandScopeExprs(expr.expr, scopeExprs) };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => expandScopeExprs(arg, scopeExprs)),
      };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => expandScopeExprs(item, scopeExprs)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => expandScopeExprs(item, scopeExprs)),
      };
    case "extract":
      return {
        ...expr,
        source: expandScopeExprs(expr.source, scopeExprs),
      };
    case "cast":
      return {
        ...expr,
        expr: expandScopeExprs(expr.expr, scopeExprs),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => expandScopeExprs(arg, scopeExprs)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => expandScopeExprs(arg, scopeExprs))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: expandScopeExprs(item.expr, scopeExprs),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: expandScopeExprs(item.when, scopeExprs),
          then: expandScopeExprs(item.then, scopeExprs),
        })),
        elseExpr: expr.elseExpr
          ? expandScopeExprs(expr.elseExpr, scopeExprs)
          : null,
      };
    default:
      return expr;
  }
}

function selectExpandedColumns(
  scopeId: string,
  columnNames: readonly string[] | null,
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): Array<{ expr: unknown; as: unknown }> {
  if (!columnNames) {
    throw new Error("Cannot expand fused columns without a schema");
  }
  return columnNames.map((name) => {
    const expr = bindFusedExpr({ kind: "column", table: scopeId, name }, scopeExprs, bindings, dialect);
    return {
      expr: exprToAst(expr),
      as: shouldAlias(expr, name)
        ? renderIdentifier({ name, quoted: false }, dialect, getSqlRenderContext())
        : null,
    };
  });
}

function selectItemsToScopeMap(items: SelectItem[]): Record<string, ExprNode<unknown>> {
  const mapping: Record<string, ExprNode<unknown>> = {};
  for (const item of items) {
    const name = selectItemName(item);
    if (!name) {
      throw new Error("Cannot fuse a stage with unnamed select items");
    }
    mapping[name] = item.expr;
  }
  return mapping;
}

function isAggregateProjection(stage: Extract<Stage, { kind: "select" }>): boolean {
  if (stage.groupBy && stage.groupBy.length > 0) return true;
  return stage.items.some((item) => containsAggregate(item.expr));
}

function containsWindow(expr: ExprNode<unknown>): boolean {
  switch (expr.kind) {
    case "window":
      return true;
    case "binary":
      return containsWindow(expr.left) || containsWindow(expr.right);
    case "unary":
      return containsWindow(expr.expr);
    case "agg":
      return containsWindow(expr.arg);
    case "group":
      return containsWindow(expr.expr);
    case "func":
      return expr.args.some(containsWindow);
    case "list":
      return expr.items.some(containsWindow);
    case "array":
      return expr.items.some(containsWindow);
    case "extract":
      return containsWindow(expr.source);
    case "cast":
      return containsWindow(expr.expr);
    case "case":
      return (
        expr.whens.some((item) => containsWindow(item.when) || containsWindow(item.then)) ||
        (expr.elseExpr ? containsWindow(expr.elseExpr) : false)
      );
    default:
      return false;
  }
}

function containsAggregate(expr: ExprNode<unknown>): boolean {
  switch (expr.kind) {
    case "agg":
      return true;
    case "binary":
      return containsAggregate(expr.left) || containsAggregate(expr.right);
    case "unary":
      return containsAggregate(expr.expr);
    case "group":
      return containsAggregate(expr.expr);
    case "func":
      return expr.args.some(containsAggregate);
    case "list":
      return expr.items.some(containsAggregate);
    case "array":
      return expr.items.some(containsAggregate);
    case "extract":
      return containsAggregate(expr.source);
    case "cast":
      return containsAggregate(expr.expr);
    case "window":
      return (
        expr.args.some(containsAggregate) ||
        (expr.partitionBy ? expr.partitionBy.some(containsAggregate) : false) ||
        (expr.orderBy ? expr.orderBy.some((item) => containsAggregate(item.expr)) : false)
      );
    case "case":
      return (
        expr.whens.some((item) => containsAggregate(item.when) || containsAggregate(item.then)) ||
        (expr.elseExpr ? containsAggregate(expr.elseExpr) : false)
      );
    default:
      return false;
  }
}

function partitionAggregatePredicate(
  predicate: ExprNode<unknown>
): { aggregate: ExprNode<unknown> | null; nonAggregate: ExprNode<unknown> | null } {
  const factorized = factorSharedPredicateConjuncts(predicate);
  const aggregate: ExprNode<unknown>[] = [];
  const nonAggregate: ExprNode<unknown>[] = [];

  if (factorized.shared) {
    for (const conjunct of splitPredicateConjuncts(factorized.shared)) {
      if (containsAggregate(conjunct)) {
        aggregate.push(conjunct);
      } else {
        nonAggregate.push(conjunct);
      }
    }
  }

  if (factorized.residual) {
    if (containsAggregate(factorized.residual)) {
      aggregate.push(factorized.residual);
    } else {
      nonAggregate.push(factorized.residual);
    }
  }

  return {
    aggregate: mergePredicateList(aggregate),
    nonAggregate: mergePredicateList(nonAggregate),
  };
}

function partitionWindowPredicate(
  predicate: ExprNode<boolean>,
  scopeExprs: ScopeExprLookup,
  bindings: ScopeBindings,
  dialect: QueryDialect
): {
  window: ExprNode<unknown> | null;
  nonWindow: ExprNode<unknown> | null;
  outerWindow: ExprNode<boolean> | null;
} {
  const factorized = factorSharedPredicateConjuncts(predicate);
  const window: ExprNode<unknown>[] = [];
  const nonWindow: ExprNode<unknown>[] = [];
  const outerWindow: ExprNode<boolean>[] = [];

  if (factorized.shared) {
    for (const conjunct of splitPredicateConjuncts(factorized.shared)) {
      const bound = bindFusedExpr(conjunct, scopeExprs, bindings, dialect);
      if (containsWindow(bound)) {
        window.push(bound);
        outerWindow.push(conjunct as ExprNode<boolean>);
      } else {
        nonWindow.push(bound);
      }
    }
  }

  if (factorized.residual) {
    const bound = bindFusedExpr(factorized.residual, scopeExprs, bindings, dialect);
    if (containsWindow(bound)) {
      window.push(bound);
      outerWindow.push(factorized.residual as ExprNode<boolean>);
    } else {
      nonWindow.push(bound);
    }
  }

  return {
    window: mergePredicateList(window),
    nonWindow: mergePredicateList(nonWindow),
    outerWindow: mergePredicateList(outerWindow) as ExprNode<boolean> | null,
  };
}

type PredicateFactorization = {
  shared: ExprNode<unknown> | null;
  residual: ExprNode<unknown> | null;
};

const MAX_NORMALIZED_PREDICATE_BRANCHES = 32;

function factorSharedPredicateConjuncts(
  predicate: ExprNode<unknown>
): PredicateFactorization {
  const normalized = normalizePredicateExpr(predicate);
  const direct = buildPredicateFactorization(
    splitPredicateDisjuncts(normalized).map((branch) =>
      dedupePredicateBranch(splitPredicateConjuncts(branch))
    )
  );
  const expanded = buildPredicateFactorization(
    predicateConjunctiveBranches(normalized)
  );
  return compareFactorizations(expanded, direct) > 0 ? expanded : direct;
}

function buildPredicateFactorization(
  branchConjuncts: ExprNode<unknown>[][]
): PredicateFactorization {
  if (branchConjuncts.length === 1) {
    return {
      shared: mergePredicateList(branchConjuncts[0] ?? []),
      residual: null,
    };
  }

  const sharedKeys = intersectPredicateKeys(branchConjuncts);
  if (sharedKeys.size === 0) {
    return {
      shared: null,
      residual: mergeDisjunctionList(
        branchConjuncts
          .map((branch) => mergePredicateList(branch))
          .filter((branch): branch is ExprNode<unknown> => branch !== null)
      ),
    };
  }

  const shared = (branchConjuncts[0] ?? []).filter((conjunct) =>
    sharedKeys.has(predicateKey(conjunct))
  );
  const residualBranches = branchConjuncts.map((conjuncts) =>
    conjuncts.filter((conjunct) => !sharedKeys.has(predicateKey(conjunct)))
  );

  if (residualBranches.some((branch) => branch.length === 0)) {
    return {
      shared: mergePredicateList(shared),
      residual: null,
    };
  }

  return {
    shared: mergePredicateList(shared),
    residual: mergeDisjunctionList(
      residualBranches
        .map((branch) => mergePredicateList(branch))
        .filter((branch): branch is ExprNode<unknown> => branch !== null)
    ),
  };
}

function compareFactorizations(
  left: PredicateFactorization,
  right: PredicateFactorization
): number {
  const leftScore = factorizationScore(left);
  const rightScore = factorizationScore(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    const difference = leftScore[index]! - rightScore[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function factorizationScore(
  factorization: PredicateFactorization
): [number, number, number] {
  const sharedConjuncts = factorization.shared
    ? splitPredicateConjuncts(factorization.shared)
    : [];
  return [
    sharedConjuncts.length,
    -sharedConjuncts.reduce(
      (count, predicate) => count + countBooleanPredicateOps(predicate),
      0
    ),
    -sharedConjuncts.reduce((count, predicate) => count + countPredicateNodes(predicate), 0),
  ];
}

function countBooleanPredicateOps(predicate: ExprNode<unknown>): number {
  switch (predicate.kind) {
    case "binary":
      return (
        (predicate.op === "AND" || predicate.op === "OR" ? 1 : 0) +
        countBooleanPredicateOps(predicate.left) +
        countBooleanPredicateOps(predicate.right)
      );
    case "unary":
      return (predicate.op === "NOT" ? 1 : 0) + countBooleanPredicateOps(predicate.expr);
    case "agg":
      return countBooleanPredicateOps(predicate.arg);
    case "func":
      return predicate.args.reduce((count, arg) => count + countBooleanPredicateOps(arg), 0);
    case "list":
      return predicate.items.reduce((count, item) => count + countBooleanPredicateOps(item), 0);
    case "array":
      return predicate.items.reduce((count, item) => count + countBooleanPredicateOps(item), 0);
    case "extract":
      return countBooleanPredicateOps(predicate.source);
    case "cast":
      return countBooleanPredicateOps(predicate.expr);
    case "window":
      return (
        predicate.args.reduce((count, arg) => count + countBooleanPredicateOps(arg), 0) +
        (predicate.partitionBy
          ? predicate.partitionBy.reduce(
              (count, item) => count + countBooleanPredicateOps(item),
              0
            )
          : 0) +
        (predicate.orderBy
          ? predicate.orderBy.reduce(
              (count, item) => count + countBooleanPredicateOps(item.expr),
              0
            )
          : 0)
      );
    case "case":
      return (
        predicate.whens.reduce(
          (count, item) =>
            count +
            countBooleanPredicateOps(item.when) +
            countBooleanPredicateOps(item.then),
          0
        ) +
        (predicate.elseExpr ? countBooleanPredicateOps(predicate.elseExpr) : 0)
      );
    default:
      return 0;
  }
}

function countPredicateNodes(predicate: ExprNode<unknown>): number {
  switch (predicate.kind) {
    case "binary":
      return 1 + countPredicateNodes(predicate.left) + countPredicateNodes(predicate.right);
    case "unary":
      return 1 + countPredicateNodes(predicate.expr);
    case "agg":
      return 1 + countPredicateNodes(predicate.arg);
    case "func":
      return 1 + predicate.args.reduce((count, arg) => count + countPredicateNodes(arg), 0);
    case "list":
      return 1 + predicate.items.reduce((count, item) => count + countPredicateNodes(item), 0);
    case "array":
      return 1 + predicate.items.reduce((count, item) => count + countPredicateNodes(item), 0);
    case "extract":
      return 1 + countPredicateNodes(predicate.source);
    case "cast":
      return 1 + countPredicateNodes(predicate.expr);
    case "window":
      return (
        1 +
        predicate.args.reduce((count, arg) => count + countPredicateNodes(arg), 0) +
        (predicate.partitionBy
          ? predicate.partitionBy.reduce((count, item) => count + countPredicateNodes(item), 0)
          : 0) +
        (predicate.orderBy
          ? predicate.orderBy.reduce((count, item) => count + countPredicateNodes(item.expr), 0)
          : 0)
      );
    case "case":
      return (
        1 +
        predicate.whens.reduce(
          (count, item) =>
            count + countPredicateNodes(item.when) + countPredicateNodes(item.then),
          0
        ) +
        (predicate.elseExpr ? countPredicateNodes(predicate.elseExpr) : 0)
      );
    default:
      return 1;
  }
}

function predicateConjunctiveBranches(
  predicate: ExprNode<unknown>
): ExprNode<unknown>[][] {
  const expanded = expandPredicateToDnfBranches(
    predicate,
    MAX_NORMALIZED_PREDICATE_BRANCHES
  );
  if (expanded) {
    return expanded.map(dedupePredicateBranch);
  }
  return splitPredicateDisjuncts(predicate).map((branch) =>
    dedupePredicateBranch(splitPredicateConjuncts(branch))
  );
}

function expandPredicateToDnfBranches(
  predicate: ExprNode<unknown>,
  branchLimit: number
): ExprNode<unknown>[][] | null {
  const normalized = unwrapPredicateGroups(predicate);

  if (normalized.kind === "binary" && normalized.op === "OR") {
    const left = expandPredicateToDnfBranches(normalized.left, branchLimit);
    if (!left) return null;
    const right = expandPredicateToDnfBranches(normalized.right, branchLimit);
    if (!right || left.length + right.length > branchLimit) {
      return null;
    }
    return [...left, ...right];
  }

  if (normalized.kind === "binary" && normalized.op === "AND") {
    const left = expandPredicateToDnfBranches(normalized.left, branchLimit);
    if (!left) return null;
    const right = expandPredicateToDnfBranches(normalized.right, branchLimit);
    if (!right || left.length * right.length > branchLimit) {
      return null;
    }
    const merged: ExprNode<unknown>[][] = [];
    for (const leftBranch of left) {
      for (const rightBranch of right) {
        merged.push([...leftBranch, ...rightBranch]);
        if (merged.length > branchLimit) {
          return null;
        }
      }
    }
    return merged;
  }

  return [[normalized]];
}

function normalizePredicateExpr(predicate: ExprNode<unknown>): ExprNode<unknown> {
  switch (predicate.kind) {
    case "group":
      return normalizePredicateExpr(predicate.expr);
    case "binary": {
      const left = normalizePredicateExpr(predicate.left);
      const right = normalizePredicateExpr(predicate.right);
      if (predicate.op === "AND" || predicate.op === "OR") {
        return mergeNormalizedBooleanTerms(
          collectBooleanTerms(left, predicate.op).concat(
            collectBooleanTerms(right, predicate.op)
          ),
          predicate.op
        );
      }
      return {
        ...predicate,
        left,
        right,
      };
    }
    case "unary": {
      return normalizeNegatedPredicate(normalizePredicateExpr(predicate.expr));
    }
    case "agg":
      return {
        ...predicate,
        arg: normalizePredicateExpr(predicate.arg),
      };
    case "func":
      return {
        ...predicate,
        args: predicate.args.map(normalizePredicateExpr),
      };
    case "list":
      return {
        ...predicate,
        items: predicate.items.map(normalizePredicateExpr),
      };
    case "array":
      return {
        ...predicate,
        items: predicate.items.map(normalizePredicateExpr),
      };
    case "extract":
      return {
        ...predicate,
        source: normalizePredicateExpr(predicate.source),
      };
    case "cast":
      return {
        ...predicate,
        expr: normalizePredicateExpr(predicate.expr),
      };
    case "window":
      return {
        ...predicate,
        args: predicate.args.map(normalizePredicateExpr),
        partitionBy: predicate.partitionBy
          ? predicate.partitionBy.map(normalizePredicateExpr)
          : null,
        orderBy: predicate.orderBy
          ? predicate.orderBy.map((item) => ({
              ...item,
              expr: normalizePredicateExpr(item.expr),
            }))
          : null,
      };
    case "case":
      return {
        ...predicate,
        whens: predicate.whens.map((item) => ({
          when: normalizePredicateExpr(item.when) as ExprNode<boolean>,
          then: normalizePredicateExpr(item.then),
        })),
        elseExpr: predicate.elseExpr
          ? normalizePredicateExpr(predicate.elseExpr)
          : null,
      };
    default:
      return predicate;
  }
}

function normalizeNegatedPredicate(predicate: ExprNode<unknown>): ExprNode<unknown> {
  const normalized = unwrapPredicateGroups(predicate);

  if (normalized.kind === "unary" && normalized.op === "NOT") {
    return normalized.expr;
  }

  if (normalized.kind === "binary" && normalized.op === "AND") {
    return mergeNormalizedBooleanTerms(
      [
        normalizeNegatedPredicate(normalized.left),
        normalizeNegatedPredicate(normalized.right),
      ],
      "OR"
    );
  }

  if (normalized.kind === "binary" && normalized.op === "OR") {
    return mergeNormalizedBooleanTerms(
      [
        normalizeNegatedPredicate(normalized.left),
        normalizeNegatedPredicate(normalized.right),
      ],
      "AND"
    );
  }

  return {
    kind: "unary",
    op: "NOT",
    expr: normalized,
  };
}

function collectBooleanTerms(
  predicate: ExprNode<unknown>,
  op: "AND" | "OR"
): ExprNode<unknown>[] {
  const normalized = unwrapPredicateGroups(predicate);
  if (normalized.kind === "binary" && normalized.op === op) {
    return [
      ...collectBooleanTerms(normalized.left, op),
      ...collectBooleanTerms(normalized.right, op),
    ];
  }
  return [normalized];
}

function mergeNormalizedBooleanTerms(
  predicates: ExprNode<unknown>[],
  op: "AND" | "OR"
): ExprNode<unknown> {
  const terms = dedupePredicateBranch(predicates);
  const merged = mergeBooleanPredicateList(terms, op);
  if (!merged) {
    throw new Error("Cannot merge an empty predicate list");
  }
  return merged;
}

function dedupePredicateBranch(predicates: ExprNode<unknown>[]): ExprNode<unknown>[] {
  const entries = new Map<string, ExprNode<unknown>>();
  for (const predicate of predicates) {
    const key = predicateKey(predicate);
    if (!entries.has(key)) {
      entries.set(key, predicate);
    }
  }
  return Array.from(entries.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, predicate]) => predicate);
}

function intersectPredicateKeys(
  branchConjuncts: ExprNode<unknown>[][]
): ReadonlySet<string> {
  const shared = new Set((branchConjuncts[0] ?? []).map(predicateKey));
  for (const branch of branchConjuncts.slice(1)) {
    const branchKeys = new Set(branch.map(predicateKey));
    for (const key of Array.from(shared)) {
      if (!branchKeys.has(key)) {
        shared.delete(key);
      }
    }
  }
  return shared;
}

function predicateKey(predicate: ExprNode<unknown>): string {
  return JSON.stringify(unwrapPredicateGroups(predicate));
}

function splitPredicateConjuncts(predicate: ExprNode<unknown>): ExprNode<unknown>[] {
  return collectBooleanTerms(predicate, "AND");
}

function splitPredicateDisjuncts(predicate: ExprNode<unknown>): ExprNode<unknown>[] {
  return collectBooleanTerms(predicate, "OR");
}

function unwrapPredicateGroups(predicate: ExprNode<unknown>): ExprNode<unknown> {
  let current = predicate;
  while (current.kind === "group") {
    current = current.expr;
  }
  return current;
}

function mergePredicateList(predicates: ExprNode<unknown>[]): ExprNode<unknown> | null {
  return mergeBooleanPredicateList(predicates, "AND");
}

function mergeDisjunctionList(predicates: ExprNode<unknown>[]): ExprNode<unknown> | null {
  return mergeBooleanPredicateList(predicates, "OR");
}

function mergeBooleanPredicateList(
  predicates: ExprNode<unknown>[],
  op: "AND" | "OR"
): ExprNode<unknown> | null {
  let current: ExprNode<unknown> | null = null;
  for (const predicate of predicates) {
    current = mergeBooleanPredicates(current, predicate, op);
  }
  return current;
}

function mergePredicates(
  current: ExprNode<unknown> | null,
  next: ExprNode<unknown>
): ExprNode<unknown> {
  return mergeBooleanPredicates(current, next, "AND");
}

function mergeBooleanPredicates(
  current: ExprNode<unknown> | null,
  next: ExprNode<unknown>,
  op: "AND" | "OR"
): ExprNode<unknown> {
  if (!current) return next;
  return {
    kind: "binary",
    op,
    left: current,
    right: next,
  };
}

function nextScopeId(stage: Stage, currentScopeId: string): string {
  switch (stage.kind) {
    case "select":
    case "join":
    case "union":
      return stage.outputScopeId;
    case "filter":
    case "orderBy":
    case "limit":
      return currentScopeId;
    default:
      return assertNever(stage);
  }
}

function nextColumnNames(
  stage: Stage,
  currentColumnNames: readonly string[] | null
): readonly string[] | null {
  switch (stage.kind) {
    case "union":
      return currentColumnNames;
    default:
      return stageOutputNames(stage) ?? currentColumnNames;
  }
}

function nextColumnIdentifiers(
  stage: Stage,
  currentColumnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null
): Readonly<Record<string, SqlIdentifier>> | null {
  switch (stage.kind) {
    case "union":
      return currentColumnIdentifiers;
    case "select":
      return selectItemsToIdentifierMap(stage.items) ?? currentColumnIdentifiers;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
      return selectItemsToIdentifierMap(stage.selectAll) ?? currentColumnIdentifiers;
    default:
      return assertNever(stage);
  }
}

function stageOutputNames(stage: Stage): readonly string[] | null {
  switch (stage.kind) {
    case "select":
      return stage.keys;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
      return selectItemNames(stage.selectAll);
    case "union":
      return null;
    default:
      return assertNever(stage);
  }
}

function selectItemNames(items: SelectItem[]): string[] | null {
  const names: string[] = [];
  for (const item of items) {
    const name = selectItemName(item);
    if (!name) return null;
    names.push(name);
  }
  return names;
}

function selectItemName(item: SelectItem): string | null {
  return selectItemOutputName(item);
}

function buildBaseFrom(source: CompileSourceRef, dialect: QueryDialect) {
  return sourceToFrom(source, dialect);
}

function fail(message: string): never {
  throw new Error(message);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
