import type { ExprNode } from "../ir/types.ts";
import { internalError } from "../errors.ts";

export function splitPredicateConjuncts(
  predicate: ExprNode<unknown>
): ExprNode<unknown>[] {
  return collectBooleanTerms(predicate, "AND");
}

export function splitPredicateDisjuncts(
  predicate: ExprNode<unknown>
): ExprNode<unknown>[] {
  return collectBooleanTerms(predicate, "OR");
}

export function mergePredicateList(
  predicates: ExprNode<unknown>[]
): ExprNode<unknown> | null {
  return mergeBooleanPredicateList(predicates, "AND");
}

export function mergeDisjunctionList(
  predicates: ExprNode<unknown>[]
): ExprNode<unknown> | null {
  return mergeBooleanPredicateList(predicates, "OR");
}

export function mergeBooleanPredicates(
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

export function dedupePredicateBranch(
  predicates: ExprNode<unknown>[]
): ExprNode<unknown>[] {
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

export function intersectPredicateKeys(
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

export function predicateKey(predicate: ExprNode<unknown>): string {
  return JSON.stringify(unwrapPredicateGroups(predicate));
}

export function unwrapPredicateGroups(
  predicate: ExprNode<unknown>
): ExprNode<unknown> {
  let current = predicate;
  while (current.kind === "group") {
    current = current.expr;
  }
  return current;
}

export function collectBooleanTerms(
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

export function mergeNormalizedBooleanTerms(
  predicates: ExprNode<unknown>[],
  op: "AND" | "OR"
): ExprNode<unknown> {
  const terms = dedupePredicateBranch(predicates);
  const merged = mergeBooleanPredicateList(terms, op);
  if (!merged) {
    internalError("INTERNAL_EMPTY_PREDICATE_MERGE", "Cannot merge an empty predicate list");
  }
  return merged;
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
