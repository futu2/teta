import type { ExprNode } from "../ir/types.ts";
import {
  dedupePredicateBranch,
  splitPredicateConjuncts,
  splitPredicateDisjuncts,
  unwrapPredicateGroups,
} from "./predicate_boolean.ts";

const MAX_NORMALIZED_PREDICATE_BRANCHES = 32;

export function predicateConjunctiveBranches(
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

  if (normalized.kind === "group") {
    return expandPredicateToDnfBranches(normalized.expr, branchLimit);
  }

  return [[normalized]];
}
