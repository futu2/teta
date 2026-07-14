import type { CaseWhenNode, ExprNode } from "../../core/types.ts";
import type { NormalizeExpressionLiteral, SqlString } from "../types.ts";
import {
  exprOf,
  fn,
  lit,
  toExprNode,
  type ExprInput,
  type ExprInputValue,
  type Expr,
} from "./core.ts";
import { group } from "./ops/aggregate.ts";
import { createStringRecord, setStringRecordValue } from "../../record.ts";

export type WhenArgs<TArgs extends readonly unknown[]> =
  TArgs extends readonly [
    infer TCondition,
    infer TValue,
    ...infer TRest,
  ]
    ? TCondition extends ExprInput<boolean | null>
      ? TValue extends ExprInput<unknown>
        ? readonly [TCondition, TValue, ...WhenArgs<TRest>]
        : never
      : never
    : TArgs extends readonly []
      ? readonly []
      : never;

type WhenValue<TArgs extends readonly unknown[]> =
  TArgs extends readonly [
    ExprInput<boolean | null>,
    infer TValue extends ExprInput<unknown>,
    ...infer TRest,
  ]
    ? NormalizeExpressionLiteral<ExprInputValue<TValue>> | WhenValue<TRest>
    : never;

type WhenHasDefault<TArgs extends readonly unknown[]> =
  TArgs extends readonly [
    infer TCondition,
    ExprInput<unknown>,
    ...infer TRest,
  ]
    ? TCondition extends true
      ? true
      : WhenHasDefault<TRest>
    : false;

export type WhenResult<TArgs extends readonly unknown[]> =
  WhenHasDefault<TArgs> extends true
    ? WhenValue<TArgs>
    : WhenValue<TArgs> | null;

export function when<const TArgs extends readonly [unknown, unknown, ...unknown[]]>(
  ...args: TArgs & WhenArgs<TArgs>
): Expr<WhenResult<TArgs>> {
  return buildWhenExpr(args) as Expr<WhenResult<TArgs>>;
}

export function mapShape<
  T extends Record<string, Expr<unknown>>,
  TOutput extends Expr<unknown>,
>(
  value: T,
  mapper: (value: T[keyof T]) => TOutput
): { [K in keyof T]: TOutput } {
  const result = createStringRecord<TOutput>() as Partial<{ [K in keyof T]: TOutput }>;
  for (const key of Object.keys(value) as Array<keyof T>) {
    setStringRecordValue(
      result as Record<string, TOutput>,
      key as string,
      mapper(value[key])
    );
  }
  return result as { [K in keyof T]: TOutput };
}

export type GroupShapeResult<T extends Record<string, Expr<unknown>>> = {
  [K in keyof T]: T[K] extends Expr<infer TValue> ? Expr<TValue, "group"> : never;
};

export function groupShape<T extends Record<string, Expr<unknown>>>(
  value: T
): GroupShapeResult<T> {
  const result = createStringRecord<unknown>() as Partial<GroupShapeResult<T>>;
  for (const key of Object.keys(value) as Array<keyof T>) {
    const item = value[key];
    if (!item) continue;
    assignGroupedShapeValue(result, key, item);
  }
  return result as GroupShapeResult<T>;
}

function assignGroupedShapeValue<T extends Record<string, Expr<unknown>>, K extends keyof T>(
  target: Partial<GroupShapeResult<T>>,
  key: K,
  value: T[K]
): void {
  setStringRecordValue(
    target as Record<string, unknown>,
    key as string,
    group(value)
  );
}

export function f<const TExprs extends readonly ExprInput<unknown>[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): Expr<SqlString> {
  const parts: ExprInput<unknown>[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    const literal = strings[i] ?? "";
    if (literal.length > 0) parts.push(literal);
    const expr = exprs[i];
    if (expr !== undefined) parts.push(expr);
  }
  if (parts.length === 0) return lit("") as Expr<SqlString>;
  return fn<SqlString>("CONCAT", ...parts) as Expr<SqlString>;
}

function buildCaseExpr<T>(
  whens: CaseWhenNode[],
  elseExpr: ExprNode<unknown> | null
): Expr<T | null> {
  return exprOf<T | null>({
    kind: "case",
    whens,
    elseExpr,
  });
}

function buildWhenExpr(args: readonly unknown[]): Expr<unknown> {
  const whens: CaseWhenNode[] = [];
  for (let i = 0; i < args.length; i += 2) {
    whens.push({
      when: toExprNode(args[i] as ExprInput<boolean | null>),
      then: toExprNode(args[i + 1] as ExprInput<unknown>),
    });
  }
  return buildCaseExpr<unknown>(whens, null);
}
