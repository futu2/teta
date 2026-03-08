import type { SelectItem } from "../types";
import {
  ColumnRef,
  ExprRef,
  shouldAlias,
  toExprNode,
  type ColumnRefs,
  type ExprRefs,
} from "./core";

export function createColumnRefs<TColumns extends Record<string, unknown>>(
  tableName: string | null,
  columnNames?: readonly string[] | null
): ColumnRefs<TColumns> {
  const cache = new Map<string, ColumnRef<unknown, string>>();
  const columns = columnNames ? [...columnNames] : [];
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
  leftKeys: readonly string[] | null,
  rightKeys: readonly string[] | null
): ColumnRefs<TLeft & TRight> {
  const mergedKeys = mergeColumnNames(leftKeys, rightKeys);
  const getColumn = (prop: string) => {
    const leftHas = leftKeys ? leftKeys.includes(prop) : false;
    const rightHas = rightKeys ? rightKeys.includes(prop) : false;
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
        return mergedKeys ?? [];
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!mergedKeys || !mergedKeys.includes(prop)) return undefined;
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
  left: readonly string[] | null,
  right: readonly string[] | null
): readonly string[] | null {
  if (!left && !right) return null;
  if (!left) return right ? [...right] : null;
  if (!right) return [...left];
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

export function selectAllItems<TColumns extends Record<string, unknown>>(
  columns: ExprRefs<TColumns>,
  columnNames: readonly string[] | null
): SelectItem[] {
  if (!columnNames) {
    throw new Error("Cannot expand select-all without a schema");
  }
  return columnNames.map((name) => {
    const value = Reflect.get(columns, name);
    if (!(value instanceof ExprRef)) {
      throw new Error(`Unknown column ref: ${name}`);
    }
    const ref = value;
    const expr = toExprNode(ref);
    return {
      expr,
      as: shouldAlias(expr, name)
        ? { name, quoted: false }
        : null,
    };
  });
}
