import type { Select, With } from "node-sql-parser";

import { ensureSelectAst, isSelectAst, toParserSelect } from "./ast.ts";
import { internalError } from "../../errors.ts";
import type { FromAst, SelectAst } from "./types.ts";

export function optimizeCtes(ast: SelectAst, ctes: With[]): With[] {
  optimizeNestedWiths(toParserSelect(ast));
  return optimizeCurrentCtes(toParserSelect(ast), ctes);
}

function optimizeCteBody(cte: With): With {
  const ast = mutableSelectAst(cte.stmt.ast, `cte ${cte.name.value}`);
  optimizeNestedWiths(ast);
  if (ast.with?.length) {
    const optimized = optimizeCurrentCtes(ast, ast.with as With[]);
    ast.with = optimized.length ? optimized : null;
  }
  return cte;
}

function optimizeNestedWiths(select: SelectAst): void {
  for (const nested of nestedSelects(select)) {
    if (nested.with?.length) {
      const optimized = optimizeCurrentCtes(nested, nested.with as With[]);
      nested.with = optimized.length ? optimized : null;
    }
    optimizeNestedWiths(nested);
  }
}

function optimizeCurrentCtes(ast: SelectAst, ctes: With[]): With[] {
  if (ctes.length === 0) return ctes;

  const known = new Map(ctes.map((cte) => [cte.name.value, optimizeCteBody(cte)]));
  const live = collectLiveCteNames(ast, known);
  return ctes.filter((cte) => live.has(cte.name.value));
}

function collectLiveCteNames(root: SelectAst, known: ReadonlyMap<string, With>): Set<string> {
  const live = new Set<string>();
  const queue = [...collectReferencedCteNames(root, known)];

  while (queue.length) {
    const name = queue.pop()!;
    if (live.has(name)) continue;
    live.add(name);

    const cte = known.get(name);
    if (!cte) continue;
    const cteAst = ensureSelectAst(cte.stmt.ast, `cte ${name}`);
    queue.push(...collectReferencedCteNames(cteAst, known));
  }

  return live;
}

function collectReferencedCteNames(
  select: SelectAst,
  known: ReadonlyMap<string, With>
): Set<string> {
  const refs = new Set<string>();

  for (const from of toFromList(select.from)) {
    if ("expr" in from && from.expr?.ast) {
      collectReferencedCteNames(ensureSelectAst(from.expr.ast, "subquery"), known).forEach(
        (name) => refs.add(name)
      );
      continue;
    }

    const tableName = from.rawTable ?? from.table;
    if (tableName && known.has(tableName)) {
      refs.add(tableName);
    }
  }

  if (select._next) {
    collectReferencedCteNames(ensureSelectAst(select._next, "set operation"), known).forEach(
      (name) => refs.add(name)
    );
  }

  return refs;
}

function nestedSelects(select: SelectAst): SelectAst[] {
  const nested: SelectAst[] = [];

  for (const from of toFromList(select.from)) {
    if ("expr" in from && from.expr?.ast) {
      nested.push(mutableSelectAst(from.expr.ast, "subquery"));
    }
  }

  if (select._next) {
    nested.push(mutableSelectAst(select._next, "set operation"));
  }

  return nested;
}

function toFromList(from: Select["from"] | FromAst[] | FromAst | null): FromAst[] {
  if (!from) return [];
  return Array.isArray(from) ? from : [from];
}

function mutableSelectAst(ast: Select | SelectAst, context: string): SelectAst {
  if (!isSelectAst(ast)) {
    internalError(
      "INTERNAL_PARSER_SELECT_EXPECTED",
      `${context} expected a select AST but got ${ast.type}`
    );
  }
  return ast as SelectAst;
}
