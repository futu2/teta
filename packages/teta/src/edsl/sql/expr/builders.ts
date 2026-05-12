import type { CaseWhenNode, ExprNode } from "../../core/types.ts";
import type { NormalizeExpressionLiteral } from "../types.ts";
import {
  ExprRef,
  fn,
  lit,
  toExprNode,
  type DeferredExprDeps,
  type DeferredExprDepsForArgs,
  type ExprInput,
  type ExprInputValue,
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

type CaseBranchInputs<TBranch> =
  TBranch extends CaseBranch<unknown, infer TCondition, infer TValue>
    ? [TCondition, TValue]
    : [];

type FlattenCaseBranchInputs<TBranches extends readonly CaseBranch<unknown>[]> =
  TBranches extends readonly [
    infer THead extends CaseBranch<unknown>,
    ...infer TTail extends readonly CaseBranch<unknown>[],
  ]
    ? [...CaseBranchInputs<THead>, ...FlattenCaseBranchInputs<TTail>]
    : [];

type CaseExprDeps<
  TBranches extends readonly CaseBranch<unknown>[],
  TElse,
> = DeferredExprDepsForArgs<[...FlattenCaseBranchInputs<TBranches>, TElse]>;

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
): ExprRef<CaseBranchesValue<TBranches> | null, CaseExprDeps<TBranches, undefined>>;
export function caseWhen<
  const TBranches extends readonly CaseBranch<unknown>[],
  TElse extends ExprInput<CaseBranchesValue<TBranches>>,
>(
  branches: TBranches,
  elseValue: TElse
): ExprRef<CaseBranchesValue<TBranches> | CaseElseValue<TElse>, CaseExprDeps<TBranches, TElse>>;
export function caseWhen<
  const TBranches extends readonly CaseBranch<unknown>[],
  TElse extends ExprInput<CaseBranchesValue<TBranches>> | undefined = undefined,
>(
  branches: TBranches,
  elseValue?: TElse
): ExprRef<CaseBranchesValue<TBranches> | CaseElseValue<TElse> | null, CaseExprDeps<TBranches, TElse>> {
  const whens = branches.map((branch) => ({
    when: toExprNode(branch.when),
    then: toExprNode(branch.then),
  }));
  const elseExpr = elseValue === undefined ? null : toExprNode(elseValue as ExprInput<unknown>);
  return buildCaseExpr<
    CaseBranchesValue<TBranches> | CaseElseValue<TElse>,
    CaseExprDeps<TBranches, TElse>
  >(whens, elseExpr);
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
  [K in keyof T]: T[K] extends ExprRef<infer TValue, infer TDeps> ? ExprRef<TValue, TDeps> : never;
};

export function groupShape<T extends Record<string, ExprRef<unknown>>>(
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
): ExprRef<string, DeferredExprDepsForArgs<TExprs>> {
  const parts: ExprInput<unknown>[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    const literal = strings[i] ?? "";
    if (literal.length > 0) parts.push(literal);
    const expr = exprs[i];
    if (expr !== undefined) parts.push(expr);
  }
  if (parts.length === 0) return lit("") as ExprRef<string, DeferredExprDepsForArgs<TExprs>>;
  return fn<string>("CONCAT", ...parts) as ExprRef<string, DeferredExprDepsForArgs<TExprs>>;
}

function buildCaseExpr<T, TDeps extends DeferredExprDeps>(
  whens: CaseWhenNode[],
  elseExpr: ExprNode<unknown> | null
): ExprRef<T | null, TDeps> {
  return new ExprRef<T | null, TDeps>({
    kind: "case",
    whens,
    elseExpr,
  });
}
