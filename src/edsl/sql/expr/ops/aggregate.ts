import type { SqlFloat, SqlInt, SqlNumber } from "../../types.ts";
import {
  ExprRef,
  aggregateExpr,
  over,
  toExprNode,
  windowExpr,
  type ExprInput,
  type PropagateNull,
  type WindowBuilder,
  type WindowSpecInput,
} from "../core.ts";

type NullableSqlNumber = SqlNumber | null;

export function group<T>(value: ExprInput<T>): ExprRef<T> {
  return new ExprRef<T>({ kind: "group", expr: toExprNode(value) as any });
}

export function count(value: ExprInput<unknown>): ExprRef<SqlInt> {
  return aggregateExpr<SqlInt>("COUNT", value);
}

export function sum<TValue extends NullableSqlNumber>(value: ExprInput<TValue>): ExprRef<TValue> {
  return aggregateExpr<TValue>("SUM", value);
}

export function avg<TValue extends NullableSqlNumber>(value: ExprInput<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>> {
  return aggregateExpr<PropagateNull<TValue, SqlFloat>>("AVG", value);
}

export function min<T>(value: ExprInput<T>): ExprRef<T> {
  return aggregateExpr<T>("MIN", value);
}

export function max<T>(value: ExprInput<T>): ExprRef<T> {
  return aggregateExpr<T>("MAX", value);
}

export function rank(_value?: ExprInput<unknown>): WindowBuilder<SqlInt> {
  return windowExpr<SqlInt>("RANK");
}

export function denseRank(_value?: ExprInput<unknown>): WindowBuilder<SqlInt> {
  return windowExpr<SqlInt>("DENSE_RANK");
}

export function rowNumber(_value?: ExprInput<unknown>): WindowBuilder<SqlInt> {
  return windowExpr<SqlInt>("ROW_NUMBER");
}

export function lag<T>(
  value: ExprInput<T>,
  offset?: ExprInput<SqlInt>,
  fallback?: ExprInput<T>
): WindowBuilder<T> {
  const args: ExprInput<unknown>[] = [value];
  if (offset !== undefined) args.push(offset);
  if (fallback !== undefined) args.push(fallback);
  return windowExpr<T>("LAG", ...args);
}

export function lead<T>(
  value: ExprInput<T>,
  offset?: ExprInput<SqlInt>,
  fallback?: ExprInput<T>
): WindowBuilder<T> {
  const args: ExprInput<unknown>[] = [value];
  if (offset !== undefined) args.push(offset);
  if (fallback !== undefined) args.push(fallback);
  return windowExpr<T>("LEAD", ...args);
}

export function percentRank(_value?: ExprInput<unknown>): WindowBuilder<SqlFloat> {
  return windowExpr<SqlFloat>("PERCENT_RANK");
}

export function ntile(buckets: ExprInput<SqlInt>): WindowBuilder<SqlInt>;
export function ntile(
  _value: ExprInput<unknown>,
  buckets: ExprInput<SqlInt>
): WindowBuilder<SqlInt>;
export function ntile(
  first: ExprInput<unknown>,
  second?: ExprInput<SqlInt>
): WindowBuilder<SqlInt> {
  const buckets = second === undefined ? (first as ExprInput<SqlInt>) : second;
  return windowExpr<SqlInt>("NTILE", buckets);
}

export function sumOver<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>,
  spec: WindowSpecInput = {}
): ExprRef<TValue> {
  return over(windowExpr<TValue>("SUM", value), spec);
}
