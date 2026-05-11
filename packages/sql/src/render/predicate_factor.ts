import type { ExprNode } from "../ir/types.ts";
import {
  dedupePredicateBranch,
  mergeBooleanPredicates,
  mergeDisjunctionList,
  mergePredicateList,
  normalizePredicateExpr,
  intersectPredicateKeys,
  predicateKey,
  splitPredicateConjuncts,
  splitPredicateDisjuncts,
} from "./predicate_boolean.ts";
import { predicateConjunctiveBranches } from "./predicate_factor_branches.ts";
import {
  compareFactorizations,
  type PredicateFactorization,
} from "./predicate_factor_score.ts";

export {
  mergeBooleanPredicates,
  mergePredicateList,
  splitPredicateConjuncts,
} from "./predicate_boolean.ts";
export type { PredicateFactorization } from "./predicate_factor_score.ts";

export function factorSharedPredicateConjuncts(
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
