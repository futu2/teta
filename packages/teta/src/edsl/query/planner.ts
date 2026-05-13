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
import { normalizeIdentifier } from "./utils.ts";

type ResolvedProjection = {
  keys: string[];
  items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }>;
};

export type SelectProjectionItem = {
  expr: ExprNode<any>;
  alias: string | null;
};

export type SelectProjection = readonly SelectProjectionItem[];

type ResolvedAggregateProjection = ResolvedProjection & {
  groupBy: ExprNode<any>[];
};

const LEGACY_SELECTION_ARRAY_ERROR = "map() and fold() now expect an object shape";

export function freshScopeId(): ScopeId {
  return `${INTERNAL_SCOPE_PREFIX}${freshInternalToken()}` as ScopeId;
}

export function freshInternalCteName(label: string): InternalCteName {
  return `${INTERNAL_CTE_PREFIX}${label}_${freshInternalToken()}` as InternalCteName;
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

export function resolveSelectProjection(selection: SelectProjection): ResolvedProjection {
  const keys: string[] = [];
  const items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }> = [];
  let generatedCount = 0;

  for (const item of selection) {
    const expr = item.expr;
    if (containsGroup(expr)) {
      userError("GROUP_OUTSIDE_AGGREGATE", "group() is only valid inside fold()");
    }

    const key = item.alias ?? selectProjectionKey(expr, generatedCount + 1);
    if (item.alias === null && expr.kind !== "column") {
      generatedCount++;
    }
    if (keys.includes(key)) {
      userError("SELECT_DUPLICATE_COLUMN", `Duplicate selected column name: ${key}`);
    }

    keys.push(key);
    items.push({
      expr,
      as: shouldAlias(expr, key)
        ? normalizeIdentifier(key, "select alias")
        : null,
    });
  }

  return { keys, items };
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

function freshInternalToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
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

function selectProjectionKey(expr: ExprNode<any>, generatedIndex: number): string {
  if (expr.kind === "column") {
    return expr.name;
  }
  return `col_${generatedIndex}`;
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
