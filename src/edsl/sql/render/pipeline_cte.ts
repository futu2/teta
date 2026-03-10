import type { AST, With } from "node-sql-parser";
import type { CteSpec } from "../../core/types.ts";
import type { QueryDialect } from "../types.ts";
import { toParserAst } from "./ast.ts";
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
  const merged = baseCtes.length ? [...baseCtes, ...stageCtes] : stageCtes;
  ast.with = merged.length ? merged : null;
  return toParserAst(ast);
}
