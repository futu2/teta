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
): Expr<ExprInputValue<TInput>, "group"> {
  return exprOf<ExprInputValue<TInput>>({
    kind: "group",
    expr: toExprNode(value as ExprInput<unknown>) as any,
  }) as Expr<ExprInputValue<TInput>, "group">;
}

export function count<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<SqlInt, "aggregate"> {
  return aggregateExpr<SqlInt, TInput>("COUNT", value) as Expr<SqlInt, "aggregate">;
}

export function sum<TInput extends ExprInput<NullableSqlNumber>>(
  value: TInput
): Expr<ExprInputValue<TInput>, "aggregate"> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("SUM", value) as Expr<ExprInputValue<TInput>, "aggregate">;
}

export function avg<TInput extends ExprInput<NullableSqlNumber>>(
  value: TInput
): Expr<PropagateNull<ExprInputValue<TInput>, SqlFloat>, "aggregate"> {
  return aggregateExpr<PropagateNull<ExprInputValue<TInput>, SqlFloat>, TInput>("AVG", value) as Expr<PropagateNull<ExprInputValue<TInput>, SqlFloat>, "aggregate">;
}

export function min<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>, "aggregate"> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("MIN", value) as Expr<ExprInputValue<TInput>, "aggregate">;
}

export function max<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>, "aggregate"> {
  return aggregateExpr<ExprInputValue<TInput>, TInput>("MAX", value) as Expr<ExprInputValue<TInput>, "aggregate">;
}

export function arrayAgg<TInput extends ExprInput<unknown>>(
  value: TInput
): Expr<ExprInputValue<TInput>[], "aggregate"> {
  return aggregateExpr<ExprInputValue<TInput>[], TInput>("ARRAY_AGG", value) as Expr<ExprInputValue<TInput>[], "aggregate">;
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
): Expr<TValue, "aggregate"> {
  return over(windowExpr<TValue>("SUM", value), spec) as Expr<TValue, "aggregate">;
}
