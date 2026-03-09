import {
  INTERNAL_CTE_PREFIX,
  INTERNAL_SCOPE_PREFIX,
  type ExprNode,
  type SqlIdentifier,
} from "../core/types";
import {
  containsGroup,
  isAliasedSelectValue,
  isProjectionItem,
  shouldAlias,
  toExprNode,
  unwrapGroupExpr,
} from "../expr";
import type { SelectSelection, SelectValue } from "../expr";
import { identifierName, normalizeIdentifier } from "./utils";

type ResolvedProjection = {
  keys: string[];
  items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }>;
};

type ResolvedAggregateProjection = ResolvedProjection & {
  groupBy: ExprNode<any>[];
};

export function freshScopeId(): string {
  return `${INTERNAL_SCOPE_PREFIX}${freshInternalToken()}`;
}

export function freshInternalCteName(label: string): string {
  return `${INTERNAL_CTE_PREFIX}${label}_${freshInternalToken()}`;
}

export function resolveSelectProjection(selection: SelectSelection): ResolvedProjection {
  const entries = projectionEntries(selection);
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const resolved = resolveProjectionExpr(item.key, item.value);
      if (containsGroup(resolved.expr)) {
        throw new Error("group() is only valid inside aggregate()");
      }
      return resolved;
    }),
  };
}

export function resolveAggregateProjection(
  selection: SelectSelection
): ResolvedAggregateProjection {
  const entries = projectionEntries(selection);
  const groupBy: ExprNode<any>[] = [];
  return {
    keys: entries.map((item) => item.key),
    items: entries.map((item) => {
      const explicitAlias = isAliasedSelectValue(item.value)
        ? assertProjectionAliasMatchesKey(
            item.key,
            normalizeIdentifier(item.value.as, "select alias")
          )
        : null;
      const expr = toExprNode(isAliasedSelectValue(item.value) ? item.value.value : item.value);
      const unwrapped = unwrapGroupExpr(expr, groupBy, false);
      return {
        expr: unwrapped,
        as: explicitAlias ?? (shouldAlias(unwrapped, item.key)
          ? normalizeIdentifier(item.key, "select alias")
          : null),
      };
    }),
    groupBy,
  };
}

function freshInternalToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function assertProjectionAliasMatchesKey(key: string, alias: SqlIdentifier): SqlIdentifier {
  if (identifierName(alias) !== key) {
    throw new Error(`Projected alias ${identifierName(alias)} must match object key ${key}`);
  }
  return alias;
}

function resolveProjectionExpr(key: string, value: SelectValue): {
  expr: ExprNode<any>;
  as: SqlIdentifier | null;
} {
  const explicitAlias = isAliasedSelectValue(value)
    ? assertProjectionAliasMatchesKey(
        key,
        normalizeIdentifier(value.as, "select alias")
      )
    : null;
  const expr = toExprNode(isAliasedSelectValue(value) ? value.value : value);
  return {
    expr,
    as: explicitAlias ?? (shouldAlias(expr, key) ? normalizeIdentifier(key, "select alias") : null),
  };
}

function assertUniqueProjectionKeys(keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`Duplicate projected column name: ${key}`);
    }
    seen.add(key);
  }
}

function projectionEntries(selection: SelectSelection): Array<{ key: string; value: SelectValue }> {
  if (!Array.isArray(selection)) {
    const shape = selection as Record<string, SelectValue>;
    return Object.keys(shape).map((key) => ({ key, value: shape[key]! }));
  }

  const entries = selection.map((item) => {
    if (!isProjectionItem(item)) {
      throw new Error("Projection lists must be built with project() or projects(); wrap preset()/selectAll()/prefix()/namespace()/remap() with projects()");
    }
    return { key: item.key, value: item.value };
  });
  assertUniqueProjectionKeys(entries.map((item) => item.key));
  return entries;
}
