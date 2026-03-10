import type { CaseWhenNode, ExprNode } from "../../core/types.ts";
import { ExprRef, fn, lit, toExprNode, type CaseBuilder, type ExprInput } from "./core.ts";
import { group } from "./ops/aggregate.ts";

export type ExprShape<T extends Record<string, ExprRef<unknown>>> = {
  map: (mapper: (value: T[keyof T]) => ExprRef<unknown>) => {
    [K in keyof T]: ExprRef<unknown>;
  };
  group: () => { [K in keyof T]: ExprRef<unknown> };
};

export function when<T>(
  condition: ExprInput<boolean>,
  value: ExprInput<T>
): CaseBuilder<T> {
  return new CaseBuilderImpl<T>([
    { when: toExprNode(condition), then: toExprNode(value) },
  ]);
}

export function shape<T extends Record<string, ExprRef<unknown>>>(value: T): ExprShape<T> {
  return {
    map(mapper) {
      const result: Record<string, ExprRef<unknown>> = {};
      for (const key of Object.keys(value) as Array<keyof T>) {
        result[key as string] = mapper(value[key]);
      }
      return result as { [K in keyof T]: ExprRef<unknown> };
    },
    group() {
      const result: Record<string, ExprRef<unknown>> = {};
      for (const key of Object.keys(value) as Array<keyof T>) {
        const item = value[key];
        if (!item) continue;
        result[key as string] = group(item);
      }
      return result as { [K in keyof T]: ExprRef<unknown> };
    },
  };
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

class CaseBuilderImpl<T> implements CaseBuilder<T> {
  constructor(private readonly whens: CaseWhenNode[]) {}

  when(condition: ExprInput<boolean>, value: ExprInput<T>): CaseBuilder<T> {
    return new CaseBuilderImpl<T>([
      ...this.whens,
      { when: toExprNode(condition), then: toExprNode(value) },
    ]);
  }

  else(value: ExprInput<T>): ExprRef<T> {
    return buildCaseExpr<T>(this.whens, toExprNode(value)) as ExprRef<T>;
  }

  end(): ExprRef<T | null> {
    return buildCaseExpr<T>(this.whens, null);
  }
}
