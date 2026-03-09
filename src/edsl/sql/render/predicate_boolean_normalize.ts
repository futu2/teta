import type { ExprNode } from "../../core/types";
import {
  collectBooleanTerms,
  mergeNormalizedBooleanTerms,
  unwrapPredicateGroups,
} from "./predicate_boolean_core";

export function normalizePredicateExpr(
  predicate: ExprNode<unknown>
): ExprNode<unknown> {
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
    case "unary":
      return normalizeNegatedPredicate(normalizePredicateExpr(predicate.expr));
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

function normalizeNegatedPredicate(
  predicate: ExprNode<unknown>
): ExprNode<unknown> {
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
