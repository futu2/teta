import type { QueryDialect } from "../types.ts";
import type { ExprNode, Stage } from "../../core/types.ts";
import type { ScopeBindings } from "./types.ts";
import type { CompiledSegment } from "./segment.ts";
import {
  isAggregateProjection,
  mergePredicates,
  partitionAggregatePredicate,
  partitionWindowPredicate,
} from "./predicate.ts";
import { bindFusedExpr, type ScopeExprLookup } from "./fused.ts";

type PostProjectionFilterOutcome =
  | {
      action: "continue";
      whereExpr: ExprNode<unknown> | null;
      havingExpr: ExprNode<unknown> | null;
      qualifyExpr: ExprNode<unknown> | null;
    }
  | { action: "stop" }
  | { action: "return"; result: CompiledSegment };

export function handlePostProjectionFilterStage(
  stage: Extract<Stage, { kind: "filter" }>,
  projection: Extract<Stage, { kind: "select" }> | null,
  scopeExprs: ScopeExprLookup,
  currentBindings: ScopeBindings,
  dialect: QueryDialect,
  whereExpr: ExprNode<unknown> | null,
  havingExpr: ExprNode<unknown> | null,
  qualifyExpr: ExprNode<unknown> | null,
  finish: (
    whereExpr: ExprNode<unknown> | null,
    havingExpr: ExprNode<unknown> | null,
    qualifyExpr: ExprNode<unknown> | null
  ) => CompiledSegment,
  recurseWindow: (
    outerWindow: ExprNode<boolean>,
    inner: CompiledSegment
  ) => CompiledSegment | null
): PostProjectionFilterOutcome {
  const { window, nonWindow, outerWindow } = partitionWindowPredicate(
    stage.predicate,
    (expr) => bindFusedExpr(expr, scopeExprs, currentBindings, dialect)
  );
  const next = bindFusedExpr(stage.predicate, scopeExprs, currentBindings, dialect);
  const useHaving = projection ? isAggregateProjection(projection) : false;
  let nextWhereExpr = whereExpr;
  let nextHavingExpr = havingExpr;
  let nextQualifyExpr = qualifyExpr;

  if (window) {
    if (nonWindow) {
      if (useHaving) {
        const { aggregate, nonAggregate } = partitionAggregatePredicate(nonWindow);
        if (nonAggregate) {
          nextWhereExpr = mergePredicates(nextWhereExpr, nonAggregate);
        }
        if (aggregate) {
          nextHavingExpr = mergePredicates(nextHavingExpr, aggregate);
        }
      } else {
        nextWhereExpr = mergePredicates(nextWhereExpr, nonWindow);
      }
    }
    if (!dialect.features.qualifyClause) {
      if (!projection || !outerWindow) {
        return { action: "stop" };
      }
      const inner = finish(nextWhereExpr, nextHavingExpr, nextQualifyExpr);
      const outer = recurseWindow(outerWindow, inner);
      if (!outer) {
        return { action: "return", result: inner };
      }
      return {
        action: "return",
        result: {
          ...outer,
          consumed: inner.consumed + outer.consumed,
        },
      };
    }
    nextQualifyExpr = mergePredicates(nextQualifyExpr, window);
  } else if (useHaving) {
    const { aggregate, nonAggregate } = partitionAggregatePredicate(next);
    if (nonAggregate) {
      nextWhereExpr = mergePredicates(nextWhereExpr, nonAggregate);
    }
    if (aggregate) {
      nextHavingExpr = mergePredicates(nextHavingExpr, aggregate);
    }
  } else {
    nextWhereExpr = mergePredicates(nextWhereExpr, next);
  }

  return {
    action: "continue",
    whereExpr: nextWhereExpr,
    havingExpr: nextHavingExpr,
    qualifyExpr: nextQualifyExpr,
  };
}
