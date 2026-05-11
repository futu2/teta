import type { AST, With } from "node-sql-parser";
import type { CteSpec } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import { toParserAst } from "./ast.ts";
import { optimizeCtes } from "./cte_optimize.ts";
import { materializeCte } from "./recursive.ts";
import type { SelectAst } from "./types.ts";

export function materializeBaseCtes(
  ctes: readonly CteSpec[],
  dialect: QueryDialect
): With[] {
  return ctes.map((cte) => materializeCte(cte, dialect));
}

export function buildPipelineParserAst(
  ast: SelectAst,
  baseCtes: With[],
  stageCtes: With[]
): AST {
  const merged = baseCtes.length ? [...baseCtes, ...stageCtes] : [...stageCtes];
  const optimized = optimizeCtes(ast, merged);
  ast.with = optimized.length ? optimized : null;
  return toParserAst(ast);
}
