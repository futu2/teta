import type { ScopeId, ProjectionItem, SqlIdentifier } from "../types.ts";
import {
  columnOf,
  isExpr,
  shouldAlias,
  toExprNode,
  type Column,
  type ColumnRefs,
  type Exprs,
} from "./core.ts";
import { internalError } from "../../errors.ts";
import { createStringRecord } from "../../record.ts";

export function createColumnRefs<TColumns extends Record<string, unknown>>(
  tableName: ScopeId | null,
  columnNames: readonly string[]
): ColumnRefs<TColumns> {
  const refs = createStringRecord<Column<unknown, string>>();
  for (const name of columnNames) {
    Object.defineProperty(refs, name, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: columnOf<unknown, string>(tableName, name),
    });
  }
  return Object.freeze(refs) as ColumnRefs<TColumns>;
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
  const refs = createStringRecord<Column<unknown, string>>();
  for (const prop of mergedKeys) {
    const leftHas = leftKeys.includes(prop);
    const rightHas = rightKeys.includes(prop);
    const leftValue = leftHas ? Reflect.get(left, prop) : undefined;
    const rightValue = rightHas ? Reflect.get(right, prop) : undefined;
    const leftRef = isExpr(leftValue) ? leftValue : undefined;
    const rightRef = isExpr(rightValue) ? rightValue : undefined;
    const ref = rightHas && !leftHas ? rightRef : leftRef ?? rightRef;
    if (!ref) {
      internalError("INTERNAL_UNKNOWN_COLUMN_REF", `Unknown column ref: ${prop}`);
    }
    Object.defineProperty(refs, prop, {
      enumerable: true,
      configurable: false,
      writable: false,
      value: ref,
    });
  }
  return Object.freeze(refs) as ColumnRefs<TLeft & TRight>;
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
  columns: Exprs<TColumns>,
  columnNames: readonly string[],
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>
): ProjectionItem[] {
  return columnNames.map((name) => {
    const value = Reflect.get(columns, name);
    if (!isExpr(value)) {
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
