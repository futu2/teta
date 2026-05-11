import type { AST, Select } from "node-sql-parser";
import { internalError } from "../errors.ts";
import { OUTER_TABLE_ALIAS } from "../ir/types.ts";
import type { FromAst, GroupByAst, LimitAst, OrderByAst, ParserExprAst, SelectAst, SelectColumnAst } from "./types.ts";

export function toParserSelect(ast: SelectAst): Select {
  if (!isParserSelect(ast)) {
    internalError("INTERNAL_PARSER_SELECT_EXPECTED", "Internal error: generated AST is not a parser-compatible SELECT");
  }
  return ast;
}

export function toParserAst(ast: SelectAst): AST {
  return toParserSelect(ast);
}

export function fromParserSelect(ast: Select): SelectAst {
  return {
    ...ast,
    columns: ast.columns as SelectColumnAst[],
    from: ast.from as FromAst[] | FromAst | null,
    where: (ast.where ?? null) as ParserExprAst | null,
    groupby: (ast.groupby ?? null) as GroupByAst | null,
    having: (ast.having ?? null) as ParserExprAst | null,
    qualify: (ast.qualify ?? null) as ParserExprAst | null,
    orderby: ast.orderby as OrderByAst[] | null,
    limit: ast.limit as LimitAst | null,
    options: ast.options ?? null,
  };
}

export function isSelectAst(ast: AST): ast is Select {
  return ast.type === "select";
}

export function ensureSelectAst(ast: AST, context: string): SelectAst {
  if (!isSelectAst(ast)) {
    internalError("INTERNAL_PARSER_SELECT_EXPECTED", `${context} expected a select AST but got ${ast.type}`);
  }
  return fromParserSelect(ast);
}

export function cloneAst<T>(ast: T): T {
  return JSON.parse(JSON.stringify(ast)) as T;
}

export function replaceOuterAlias(ast: AST, baseAlias: string): AST {
  const copy = cloneAst(ast);
  applyOuterAlias(copy, baseAlias);
  return copy;
}

export function containsOuterAlias(node: unknown): boolean {
  if (!node) return false;
  if (Array.isArray(node)) return node.some((item) => containsOuterAlias(item));
  if (!isObjectRecord(node)) return false;
  if (node.type === "column_ref" && node.table === OUTER_TABLE_ALIAS) return true;
  return Object.values(node).some((value) => containsOuterAlias(value));
}

export function ensureAlias(from: { as?: unknown | null; table?: string | null }): string {
  if (typeof from.as === "string" && from.as) return from.as;
  const rawAlias = Reflect.get(from, "rawAlias") as string | null | undefined;
  if (rawAlias) return rawAlias;
  const base = (Reflect.get(from, "rawTable") as string | null | undefined) ?? from.table ?? "t";
  const sanitizedBase = base.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const alias = `${sanitizedBase || "t"}_0`;
  from.as = alias;
  return alias;
}

function isParserSelect(value: unknown): value is Select {
  return isObjectRecord(value) && value.type === "select";
}

function applyOuterAlias(node: unknown, baseAlias: string): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => applyOuterAlias(item, baseAlias));
    return;
  }
  if (!isObjectRecord(node)) return;
  if (node.type === "column_ref" && node.table === OUTER_TABLE_ALIAS) {
    node.table = baseAlias;
  }
  for (const value of Object.values(node)) {
    applyOuterAlias(value, baseAlias);
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
