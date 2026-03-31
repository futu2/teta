import type { ExprNode, Stage } from "../../core/types.ts";
import {
  factorSharedPredicateConjuncts,
  mergeBooleanPredicates,
  mergePredicateList,
  splitPredicateConjuncts,
} from "./predicate_factor.ts";
import { containsAggregate, containsWindow } from "./predicate_contains.ts";

export function isAggregateProjection(stage: Extract<Stage, { kind: "map" | "fold" }>): boolean {
  if (stage.groupBy && stage.groupBy.length > 0) return true;
  return stage.items.some((item) => containsAggregate(item.expr));
}

export function partitionAggregatePredicate(
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

export function partitionWindowPredicate(
  predicate: ExprNode<boolean>,
  bindPredicate: (expr: ExprNode<unknown>) => ExprNode<unknown>
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
      const bound = bindPredicate(conjunct);
      if (containsWindow(bound)) {
        window.push(bound);
        outerWindow.push(conjunct as ExprNode<boolean>);
      } else {
        nonWindow.push(bound);
      }
    }
  }

  if (factorized.residual) {
    const bound = bindPredicate(factorized.residual);
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

export function mergePredicates(
  current: ExprNode<unknown> | null,
  next: ExprNode<unknown>
): ExprNode<unknown> {
  return mergeBooleanPredicates(current, next, "AND");
}
