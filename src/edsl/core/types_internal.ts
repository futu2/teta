export const OUTER_TABLE_ALIAS = "__teta_outer__";
export const INTERNAL_SCOPE_PREFIX = "__teta_scope_";
export const INTERNAL_CTE_PREFIX = "__teta_cte_";

export type ScopeId = string & { readonly __brand: "TetaScopeId" };
export type InternalCteName = string & { readonly __brand: "TetaInternalCteName" };
export type GeneratedCteName = string & { readonly __brand: "TetaGeneratedCteName" };

export function isInternalScopeName(value: string | null): value is ScopeId {
  return value !== null && value.startsWith(INTERNAL_SCOPE_PREFIX);
}

export function isInternalCteName(value: string | null): value is InternalCteName {
  return value !== null && value.startsWith(INTERNAL_CTE_PREFIX);
}

export function internalCteLabel(value: string): string | null {
  if (!isInternalCteName(value)) return null;
  const remainder = value.slice(INTERNAL_CTE_PREFIX.length);
  const separatorIndex = remainder.indexOf("_");
  return separatorIndex >= 0 ? remainder.slice(0, separatorIndex) : remainder;
}

export function generatedCteName(
  prefix: string,
  label: string,
  index: number
): GeneratedCteName {
  return `${prefix}${label}_${index}` as GeneratedCteName;
}
