import type { ExprNode } from "../../core/types.ts";
import { splitPredicateConjuncts } from "./predicate_boolean.ts";

export type PredicateFactorization = {
  shared: ExprNode<unknown> | null;
  residual: ExprNode<unknown> | null;
};

export function compareFactorizations(
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
