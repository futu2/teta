import {
  INTERNAL_CTE_PREFIX,
  INTERNAL_SCOPE_PREFIX,
  type InternalCteName,
  type ScopeId,
} from "../core/types.ts";
import type { QueryNameSupply, QueryState } from "./state.ts";

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

export function mergeNameSupply(
  left: QueryNameSupply,
  right: QueryNameSupply
): QueryNameSupply {
  return Object.freeze({
    scope: Math.max(left.scope, right.scope),
    cte: Math.max(left.cte, right.cte),
  });
}

function scopeIdFromIndex(index: number): ScopeId {
  return `${INTERNAL_SCOPE_PREFIX}${index}` as ScopeId;
}

function cteNameFromIndex(label: string, index: number): InternalCteName {
  return `${INTERNAL_CTE_PREFIX}${label}_${index}` as InternalCteName;
}
