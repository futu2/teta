import {
  INTERNAL_CTE_PREFIX,
  INTERNAL_SCOPE_PREFIX,
  type ExprNode,
  type InternalCteName,
  type ScopeId,
  type SqlIdentifier,
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
import type { QueryNameSupply, QueryState } from "./state.ts";
import { normalizeIdentifier } from "./utils.ts";

type ResolvedProjection = {
  keys: string[];
  items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }>;
};

type ResolvedAggregateProjection = ResolvedProjection & {
  groupBy: ExprNode<any>[];
};

export function initialScopeId(): ScopeId {
  return scopeIdFromIndex(0);
}

export function allocateScopeId(
  state: Pick<QueryState<Record<string, unknown>>, "nameSupply">
): { scopeId: ScopeId; nameSupply: QueryNameSupply } {
  const scopeId = scopeIdFromIndex(state.nameSupply.scope);
  return {
    scopeId,
    nameSupply: Object.freeze({
      ...state.nameSupply,
      scope: state.nameSupply.scope + 1,
    }),
  };
}

export function allocateInternalCteName(
  state: Pick<QueryState<Record<string, unknown>>, "nameSupply">,
  label: string
): { name: InternalCteName; nameSupply: QueryNameSupply } {
  const name = cteNameFromIndex(label, state.nameSupply.cte);
  return {
    name,
    nameSupply: Object.freeze({
      ...state.nameSupply,
      cte: state.nameSupply.cte + 1,
    }),
  };
}

export function reserveQueryScopes(count: number): QueryNameSupply {
  return Object.freeze({
    scope: count,
    cte: 0,
  });
}

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

export function legacySelectionArrayError(): string {
  return LEGACY_SELECTION_ARRAY_ERROR;
}

function scopeIdFromIndex(index: number): ScopeId {
  return `${INTERNAL_SCOPE_PREFIX}${index}` as ScopeId;
}

function cteNameFromIndex(label: string, index: number): InternalCteName {
  return `${INTERNAL_CTE_PREFIX}${label}_${index}` as InternalCteName;
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
