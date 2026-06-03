import type { SqlFloat, SqlInt, SqlNumber } from "../../types.ts";
import {
  aggregateExpr,
  exprOf,
  over,
  toExprNode,
  windowExpr,
  type ExprInput,
  type ExprInputValue,
  type Expr,
  type PropagateNull,
  type WindowBuilder,
  type WindowSpecInput,
} from "../core.ts";

type NullableSqlNumber = SqlNumber | null;

export function group<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>> {
  return exprOf<ExprInputValue<TInput>>({
    kind: "group",
    expr: toExprNode(value as ExprInput<unknown>) as any,
  });
}

export function count<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<SqlInt> {
  return aggregateExpr<SqlInt, TInput>("COUNT", value);
}

export function sum<TInput extends ExprInput<NullableSqlNumber>>(
  value: TInput
): Expr<ExprInputValue<TInput>> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("SUM", value);
}

export function avg<TInput extends ExprInput<NullableSqlNumber>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlFloat>> {
  return aggregateExpr<PropagateNull<ExprInputValue<TInput>, SqlFloat>, TInput>("AVG", value);
}

export function min<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("MIN", value);
}

export function max<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("MAX", value);
}

export function arrayAgg<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>[]> {
  return aggregateExpr<ExprInputValue<TInput>[], TInput>("ARRAY_AGG", value);
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
): Expr<TValue> {
  return over(windowExpr<TValue>("SUM", value), spec);
}
