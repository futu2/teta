import type { Select, With } from "node-sql-parser";

import { cloneAst, ensureSelectAst } from "./ast.ts";
import { internalError } from "../../errors.ts";
import type { FromAst, SelectAst, SubqueryFromRef } from "./types.ts";

export function optimizeCtes(ast: SelectAst, ctes: With[]): With[] {
  optimizeNestedWiths(ast);
  return optimizeCurrentCtes(ast, ctes);
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

  const prepared = ctes.map((cte) => optimizeCteBody(cte));
  const originalLive = collectLiveCteNames(ast, new Map(prepared.map((cte) => [cte.name.value, cte])));
  const renameMap = buildCanonicalRenameMap(prepared, originalLive);

  rewriteSelectCteRefs(ast, renameMap);
  prepared.forEach((cte) =>
    rewriteSelectCteRefs(mutableSelectAst(cte.stmt.ast, `cte ${cte.name.value}`), renameMap)
  );

  const survivors = prepared.filter(
    (cte) => resolveCanonicalName(cte.name.value, renameMap) === cte.name.value
  );
  const live = collectLiveCteNames(ast, new Map(survivors.map((cte) => [cte.name.value, cte])));
  return survivors.filter((cte) => live.has(cte.name.value));
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
    if (isSubqueryFrom(from)) {
      collectReferencedCteNames(mutableSelectAst(from.expr.ast, "subquery"), known).forEach((name) =>
        refs.add(name)
      );
      continue;
    }

    const tableName = from.rawTable ?? from.table;
    if (tableName && known.has(tableName)) {
      refs.add(tableName);
    }
  }

  if (select._next) {
    collectReferencedCteNames(mutableSelectAst(select._next, "set operation"), known).forEach((name) =>
      refs.add(name)
    );
  }

  return refs;
}

function nestedSelects(select: SelectAst): SelectAst[] {
  const nested: SelectAst[] = [];

  for (const from of toFromList(select.from)) {
    if (isSubqueryFrom(from)) {
      nested.push(mutableSelectAst(from.expr.ast, "subquery"));
    }
  }

  if (select._next) {
    nested.push(mutableSelectAst(select._next, "set operation"));
  }

  return nested;
}

function toFromList(from: FromAst[] | FromAst | null): FromAst[] {
  if (!from) return [];
  return Array.isArray(from) ? from : [from];
}

function buildCanonicalRenameMap(
  ctes: With[],
  originalLive: ReadonlySet<string>
): Map<string, string> {
  const canonicalByFingerprint = new Map<string, { name: string; live: boolean }>();
  const renameMap = new Map<string, string>();

  for (const cte of ctes) {
    if ((cte as With & { recursive?: boolean }).recursive) continue;

    const fingerprint = fingerprintCte(cte, renameMap);
    const candidate = canonicalByFingerprint.get(fingerprint);
    const isLive = originalLive.has(cte.name.value);
    if (candidate) {
      if (isLive && !candidate.live) {
        renameMap.set(candidate.name, cte.name.value);
        canonicalByFingerprint.set(fingerprint, { name: cte.name.value, live: true });
        continue;
      }

      renameMap.set(cte.name.value, candidate.name);
      continue;
    }

    canonicalByFingerprint.set(fingerprint, { name: cte.name.value, live: isLive });
  }

  return renameMap;
}

function fingerprintCte(cte: With, renameMap: ReadonlyMap<string, string>): string {
  const ast = cloneAst(mutableSelectAst(cte.stmt.ast, `fingerprint ${cte.name.value}`));
  rewriteSelectCteRefs(ast, renameMap);
  return JSON.stringify(ast);
}

function rewriteSelectCteRefs(select: SelectAst, renameMap: ReadonlyMap<string, string>): void {
  for (const from of toFromList(select.from)) {
    if (isSubqueryFrom(from)) {
      rewriteSelectCteRefs(mutableSelectAst(from.expr.ast, "subquery"), renameMap);
      continue;
    }

    const tableName = from.rawTable ?? from.table;
    if (!tableName) continue;

    const canonical = resolveCanonicalName(tableName, renameMap);
    if (canonical === tableName) continue;

    from.table = canonical;
    from.rawTable = canonical;
  }

  if (select._next) {
    rewriteSelectCteRefs(mutableSelectAst(select._next, "set operation"), renameMap);
  }

  if (select.with?.length) {
    select.with.forEach((cte) =>
      rewriteSelectCteRefs(mutableSelectAst(cte.stmt.ast, `cte ${cte.name.value}`), renameMap)
    );
  }
}

function resolveCanonicalName(name: string, renameMap: ReadonlyMap<string, string>): string {
  let current = name;
  while (renameMap.has(current)) {
    current = renameMap.get(current)!;
  }
  return current;
}

function mutableSelectAst(ast: Select | SelectAst, context: string): SelectAst {
  if (ast.type !== "select") {
    internalError(
      "INTERNAL_PARSER_SELECT_EXPECTED",
      `${context} expected a select AST but got ${ast.type}`
    );
  }
  return ast as SelectAst;
}

function isSubqueryFrom(from: FromAst): from is SubqueryFromRef {
  return typeof from.expr === "object" && from.expr !== null && "ast" in from.expr;
}
