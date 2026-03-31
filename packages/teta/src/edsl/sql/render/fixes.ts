import type { AST } from "node-sql-parser";
import { userError } from "../../errors.ts";
import type { QueryDialect } from "../types.ts";
import { cloneAst, isSelectAst } from "./ast.ts";

export function applyDialectFixes(ast: AST, dialect: QueryDialect): AST {
  if (!dialect.features.recursiveCte && containsRecursiveCte(ast)) {
    userError("UNSUPPORTED_RECURSIVE_CTE", `Dialect ${dialect.name} does not support recursive CTE`);
  }
  if (dialect.features.lateralJoinKeyword) return ast;
  const copy = cloneAst(ast);
  stripLateralPrefix(copy);
  return copy;
}

function containsRecursiveCte(ast: AST): boolean {
  if (!isSelectAst(ast)) return false;
  const withClause = ast.with;
  if (!Array.isArray(withClause) || withClause.length === 0) return false;
  return withClause.some((item) => Reflect.get(item, "recursive") === true);
}

function stripLateralPrefix(node: unknown): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => stripLateralPrefix(item));
    return;
  }
  if (!isObjectRecord(node)) return;
  if (node.prefix === "lateral") {
    delete node.prefix;
  }
  for (const value of Object.values(node)) {
    stripLateralPrefix(value);
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
