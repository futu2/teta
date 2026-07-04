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
