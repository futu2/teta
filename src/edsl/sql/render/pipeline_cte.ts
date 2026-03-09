import type { AST, With } from "node-sql-parser";
import type { CteSpec } from "../../core/types";
import type { QueryDialect } from "../types";
import { toParserAst } from "./ast";
import { materializeCte } from "./recursive";
import type { SelectAst } from "./types";

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
