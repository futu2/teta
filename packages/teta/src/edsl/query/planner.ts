import type {
  ExprNode,
  SqlIdentifier,
} from "../core/types.ts";
import {
  containsGroup,
  shouldAlias,
  toExprNode,
  unwrapGroupExpr,
} from "../expr.ts";
import { userError } from "../errors.ts";
import type { ProjectionShape, ProjectionValue } from "../expr.ts";
import { LEGACY_SELECTION_ARRAY_ERROR } from "./projection_validation.ts";
import { normalizeIdentifier } from "./utils.ts";
export {
  allocateInternalCteName,
  allocateScopeId,
  initialScopeId,
  reserveQueryScopes,
} from "./name_supply.ts";

type ResolvedProjection = {
  keys: string[];
  items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }>;
};

type ResolvedAggregateProjection = ResolvedProjection & {
  groupBy: ExprNode<any>[];
};

export function resolveProjection(selection: ProjectionShape): ResolvedProjection {
  const entries = projectionEntries(selection);
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const resolved = resolveProjectionExpr(item.key, item.value);
      if (containsGroup(resolved.expr)) {
        userError("GROUP_OUTSIDE_AGGREGATE", "group() is only valid inside fold()");
      }
      return resolved;
    }),
  };
}

export function resolveFoldProjection(
  selection: ProjectionShape
): ResolvedAggregateProjection {
  const entries = projectionEntries(selection);
  const groupBy: ExprNode<any>[] = [];
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const expr = toExprNode(item.value);
      assertFoldExpression(expr);
      const unwrapped = unwrapGroupExpr(expr, groupBy, false);
      return {
        expr: unwrapped,
        as: shouldAlias(unwrapped, item.key)
          ? normalizeIdentifier(item.key, "map alias")
          : null,
      };
    }),
    groupBy,
  };
}

/** Validate aggregate projection legality after TypeScript phase metadata is erased. */
function assertFoldExpression(
  expr: ExprNode<unknown>,
  grouped = false,
  inAggregate = false,
): void {
  switch (expr.kind) {
    case "column":
      if (!grouped && !inAggregate) {
        userError(
          "GROUP_OUTSIDE_AGGREGATE",
          "fold() expressions must be wrapped in group() or used inside an aggregate"
        );
      }
      return;
    case "literal":
    case "param":
      return;
    case "group":
      if (inAggregate) {
        userError("GROUP_INSIDE_AGGREGATE_FUNCTION", "group() cannot be used inside fold functions");
      }
      assertFoldExpression(expr.expr, true, false);
      return;
    case "agg":
      if (grouped) {
        userError("GROUP_OUTSIDE_AGGREGATE", "aggregate expressions cannot be wrapped in group()");
      }
      assertFoldExpression(expr.arg, false, true);
      return;
    case "window":
      userError("GROUP_OUTSIDE_AGGREGATE", "window expressions are not valid inside fold()");
    case "binary":
      assertFoldExpression(expr.left, grouped, inAggregate);
      assertFoldExpression(expr.right, grouped, inAggregate);
      return;
    case "unary":
      assertFoldExpression(expr.expr, grouped, inAggregate);
      return;
    case "extract":
      assertFoldExpression(expr.source, grouped, inAggregate);
      return;
    case "builtin":
    case "func":
      expr.args.forEach((arg) => assertFoldExpression(arg, grouped, inAggregate));
      return;
    case "list":
    case "array":
      expr.items.forEach((item) => assertFoldExpression(item, grouped, inAggregate));
      return;
    case "cast":
      assertFoldExpression(expr.expr, grouped, inAggregate);
      return;
    case "case":
      expr.whens.forEach((branch) => {
        assertFoldExpression(branch.when, grouped, inAggregate);
        assertFoldExpression(branch.then, grouped, inAggregate);
      });
      if (expr.elseExpr) assertFoldExpression(expr.elseExpr, grouped, inAggregate);
      return;
  }
}

function resolveProjectionExpr(key: string, value: ProjectionValue): {
  expr: ExprNode<any>;
  as: SqlIdentifier | null;
} {
  const expr = toExprNode(value);
  return {
    expr,
    as: shouldAlias(expr, key)
      ? normalizeIdentifier(key, "map alias")
      : null,
  };
}

function projectionEntries(selection: ProjectionShape): Array<{ key: string; value: ProjectionValue }> {
  if (Array.isArray(selection)) {
    userError("LEGACY_SELECTION_ARRAY", LEGACY_SELECTION_ARRAY_ERROR);
  }

  return Object.keys(selection).map((key) => ({
    key,
    value: selection[key]!,
  }));
}
