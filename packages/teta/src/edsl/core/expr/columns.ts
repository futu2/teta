import type { ScopeId, ProjectionItem, SqlIdentifier } from "../types.ts";
import {
  ColumnRef,
  ExprRef,
  shouldAlias,
  toExprNode,
  type ColumnRefs,
  type ExprRefs,
} from "./core.ts";
import { internalError } from "../../errors.ts";

export function createColumnRefs<TColumns extends Record<string, unknown>>(
  tableName: ScopeId | null,
  columnNames: readonly string[]
): ColumnRefs<TColumns> {
  const cache = new Map<string, ColumnRef<unknown, string>>();
  const columns = [...columnNames];
  const getColumn = (name: string) => {
    const existing = cache.get(name);
    if (existing) return existing;
    const next = new ColumnRef<unknown, string>(tableName, name);
    cache.set(name, next);
    return next;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return getColumn(prop);
      },
      ownKeys() {
        return columns;
      },
      has(_target, prop) {
        return typeof prop === "string" && columns.includes(prop);
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!columns.includes(prop)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: getColumn(prop),
        };
      },
    }
  ) as ColumnRefs<TColumns>;
}

export function mergeColumnRefs<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>,
  leftKeys: readonly string[],
  rightKeys: readonly string[]
): ColumnRefs<TLeft & TRight> {
  const mergedKeys = mergeColumnNames(leftKeys, rightKeys);
  const getColumn = (prop: string) => {
    const leftHas = leftKeys.includes(prop);
    const rightHas = rightKeys.includes(prop);
    const leftValue = Reflect.get(left, prop);
    const rightValue = Reflect.get(right, prop);
    const leftRef = leftValue instanceof ExprRef ? leftValue : undefined;
    const rightRef = rightValue instanceof ExprRef ? rightValue : undefined;
    if (rightHas && !leftHas) return rightRef;
    return leftRef ?? rightRef;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return getColumn(prop);
      },
      ownKeys() {
        return mergedKeys;
      },
      has(_target, prop) {
        return typeof prop === "string" && mergedKeys.includes(prop);
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!mergedKeys.includes(prop)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: getColumn(prop),
        };
      },
    }
  ) as ColumnRefs<TLeft & TRight>;
}

export function mergeColumnNames(
  left: readonly string[],
  right: readonly string[]
): readonly string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const key of left) {
    if (!seen.has(key)) {
      merged.push(key);
      seen.add(key);
    }
  }
  for (const key of right) {
    if (!seen.has(key)) {
      merged.push(key);
      seen.add(key);
    }
  }
  return merged;
}

export function projectAllItems<TColumns extends Record<string, unknown>>(
  columns: ExprRefs<TColumns>,
  columnNames: readonly string[],
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>
): ProjectionItem[] {
  return columnNames.map((name) => {
    const value = Reflect.get(columns, name);
    if (!(value instanceof ExprRef)) {
      internalError("INTERNAL_UNKNOWN_COLUMN_REF", `Unknown column ref: ${name}`);
    }
    const ref = value;
    const expr = toExprNode(ref);
    const identifier = columnIdentifiers?.[name] ?? null;
    return {
      expr,
      as: shouldAlias(expr, name) || identifier?.quoted
        ? (identifier ?? { name, quoted: false })
        : null,
    };
  });
}
