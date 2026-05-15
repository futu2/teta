import type { CaseWhenNode, ExprNode } from "../../core/types.ts";
import type { NormalizeExpressionLiteral } from "../types.ts";
import {
  exprOf,
  fn,
  lit,
  toExprNode,
  type ExprInput,
  type ExprInputValue,
  type ExprLike,
  type ExprRef,
} from "./core.ts";
import { group } from "./ops/aggregate.ts";

export type CaseBranch<
  T,
  TCondition extends ExprInput<boolean> = ExprInput<boolean>,
  TValue extends ExprInput<unknown> = ExprInput<T>,
> = {
  when: TCondition;
  then: TValue;
};

type CaseBranchValue<TBranch> =
  TBranch extends CaseBranch<unknown, ExprInput<boolean>, infer TValue>
    ? NormalizeExpressionLiteral<ExprInputValue<TValue>>
    : never;

type CaseBranchesValue<TBranches extends readonly CaseBranch<unknown>[]> =
  CaseBranchValue<TBranches[number]>;

type CaseElseValue<TElse> =
  TElse extends ExprInput<unknown>
    ? NormalizeExpressionLiteral<ExprInputValue<TElse>>
    : never;

export function when<TCondition extends ExprInput<boolean>, TValue extends ExprInput<unknown>>(
  condition: TCondition,
  value: TValue
): CaseBranch<NormalizeExpressionLiteral<ExprInputValue<TValue>>, TCondition, TValue> {
  return {
    when: condition,
    then: value,
  };
}

export function caseWhen<const TBranches extends readonly CaseBranch<unknown>[]>(
  branches: TBranches
): ExprRef<CaseBranchesValue<TBranches> | null>;
export function caseWhen<
  const TBranches extends readonly CaseBranch<unknown>[],
  TElse extends ExprInput<CaseBranchesValue<TBranches>>,
>(
  branches: TBranches,
  elseValue: TElse
): ExprRef<CaseBranchesValue<TBranches> | CaseElseValue<TElse>>;
export function caseWhen<
  const TBranches extends readonly CaseBranch<unknown>[],
  TElse extends ExprInput<CaseBranchesValue<TBranches>> | undefined = undefined,
>(
  branches: TBranches,
  elseValue?: TElse
): ExprRef<CaseBranchesValue<TBranches> | CaseElseValue<TElse> | null> {
  const whens = branches.map((branch) => ({
    when: toExprNode(branch.when),
    then: toExprNode(branch.then),
  }));
  const elseExpr = elseValue === undefined ? null : toExprNode(elseValue as ExprInput<unknown>);
  return buildCaseExpr<CaseBranchesValue<TBranches> | CaseElseValue<TElse>>(whens, elseExpr);
}

export function mapShape<
  T extends Record<string, ExprLike<unknown>>,
  TOutput extends ExprLike<unknown>,
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

export type GroupShapeResult<T extends Record<string, ExprLike<unknown>>> = {
  [K in keyof T]: T[K] extends ExprLike<infer TValue> ? ExprRef<TValue> : never;
};

export function groupShape<T extends Record<string, ExprLike<unknown>>>(
  value: T
): GroupShapeResult<T> {
  const result: Partial<GroupShapeResult<T>> = {};
  for (const key of Object.keys(value) as Array<keyof T>) {
    const item = value[key];
    if (!item) continue;
    result[key] = group(item) as unknown as GroupShapeResult<T>[typeof key];
  }
  return result as GroupShapeResult<T>;
}

export function f<const TExprs extends readonly ExprInput<unknown>[]>(
  strings: TemplateStringsArray,
  ...exprs: TExprs
): ExprRef<string> {
  const parts: ExprInput<unknown>[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    const literal = strings[i] ?? "";
    if (literal.length > 0) parts.push(literal);
    const expr = exprs[i];
    if (expr !== undefined) parts.push(expr);
  }
  if (parts.length === 0) return lit("") as ExprRef<string>;
  return fn<string>("CONCAT", ...parts) as ExprRef<string>;
}

function buildCaseExpr<T>(
  whens: CaseWhenNode[],
  elseExpr: ExprNode<unknown> | null
): ExprRef<T | null> {
  return exprOf<T | null>({
    kind: "case",
    whens,
    elseExpr,
  });
}
