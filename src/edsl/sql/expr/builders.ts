import type { CaseWhenNode, ExprNode } from "../../core/types.ts";
import { ExprRef, fn, lit, toExprNode, type ExprInput } from "./core.ts";
import { group } from "./ops/aggregate.ts";

export type CaseBranch<T> = {
  when: ExprInput<boolean>;
  then: ExprInput<T>;
};

export function when<T>(condition: ExprInput<boolean>, value: ExprInput<T>): CaseBranch<T> {
  return {
    when: condition,
    then: value,
  };
}

export function caseWhen<T>(branches: readonly CaseBranch<T>[]): ExprRef<T | null>;
export function caseWhen<T>(
  branches: readonly CaseBranch<T>[],
  elseValue: ExprInput<T>
): ExprRef<T>;
export function caseWhen<T>(
  branches: readonly CaseBranch<T>[],
  elseValue?: ExprInput<T>
): ExprRef<T | null> {
  const whens = branches.map((branch) => ({
    when: toExprNode(branch.when),
    then: toExprNode(branch.then),
  }));
  const elseExpr = elseValue === undefined ? null : toExprNode(elseValue);
  return buildCaseExpr<T>(whens, elseExpr) as ExprRef<T | null>;
}

export function mapShape<
  T extends Record<string, ExprRef<unknown>>,
  TOutput extends ExprRef<unknown>,
>(
  value: T,
  mapper: (value: T[keyof T]) => TOutput
): { [K in keyof T]: TOutput } {
  const result: Partial<{ [K in keyof T]: TOutput }> = {};
  for (const key of Object.keys(value) as Array<keyof T>) {
    result[key] = mapper(value[key]);
  }
  return result as { [K in keyof T]: TOutput };
}

export type GroupShapeResult<T extends Record<string, ExprRef<unknown>>> = {
  [K in keyof T]: T[K] extends ExprRef<infer TValue> ? ExprRef<TValue> : never;
};

export function groupShape<T extends Record<string, ExprRef<unknown>>>(
  value: T
): GroupShapeResult<T> {
  const result: Partial<GroupShapeResult<T>> = {};
  for (const key of Object.keys(value) as Array<keyof T>) {
    const item = value[key];
    if (!item) continue;
    result[key] = group(item) as GroupShapeResult<T>[typeof key];
  }
  return result as GroupShapeResult<T>;
}

export function f(
  strings: TemplateStringsArray,
  ...exprs: ExprInput<unknown>[]
): ExprRef<string> {
  const parts: ExprInput<unknown>[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    const literal = strings[i] ?? "";
    if (literal.length > 0) parts.push(literal);
    const expr = exprs[i];
    if (expr !== undefined) parts.push(expr);
  }
  if (parts.length === 0) return lit("");
  return fn<string>("CONCAT", ...parts);
}

function buildCaseExpr<T>(
  whens: CaseWhenNode[],
  elseExpr: ExprNode<unknown> | null
): ExprRef<T | null> {
  return new ExprRef<T | null>({
    kind: "case",
    whens,
    elseExpr,
  });
}
