import type { AST, With } from "node-sql-parser";
import type { CteSpec, Source, Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import { toParserAst } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { buildRecursiveCte, createDeferredRecursiveCte, materializeCte } from "./recursive";

export { buildRecursiveCte, createDeferredRecursiveCte } from "./recursive";

export function renderPipelineAst(
  source: Source,
  stages: Stage[],
  columnNames: readonly string[] | null,
  options?: {
    ctePrefix?: string;
    baseCtes?: CteSpec[];
    keepTables?: Set<string>;
    dialect?: QueryDialect;
  }
): AST {
  const dialect = options?.dialect ?? getDefaultDialect();
  const { ast, ctes } = buildPipelineAst(source, stages, columnNames, { ...options, dialect });
  const baseCtes = (options?.baseCtes ?? []).map((item) => materializeCte(item, dialect));
  const merged: With[] = baseCtes.length ? [...baseCtes, ...ctes] : ctes;
  ast.with = merged.length ? merged : null;
  return toParserAst(ast);
}
