import type { QueryDialect } from "../types.ts";
import { usesBackslashStringEscapes } from "../dialect/string_literals.ts";

const RESERVED_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "group",
  "by",
  "having",
  "order",
  "limit",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "cross",
  "on",
  "as",
  "and",
  "or",
  "not",
  "null",
  "true",
  "false",
  "distinct",
  "union",
  "all",
  "exists",
  "like",
  "in",
  "is",
]);

type QuoteCleanupDialect = Pick<QueryDialect, "name" | "parserDialect">;

/** Remove identifier quotes that are not needed for parser-safe SQL. */
export function stripRedundantQuotes(
  sql: string,
  dialect?: QuoteCleanupDialect
): string {
  const output: string[] = [];
  const backslashStringEscapes = usesBackslashStringEscapes(dialect);
  let index = 0;

  while (index < sql.length) {
    if (sql[index] === "'") {
      index = copyQuotedToken(sql, index, "'", output, backslashStringEscapes);
      continue;
    }
    if (sql.startsWith("--", index)) {
      index = copyLineComment(sql, index, output);
      continue;
    }
    if (sql.startsWith("/*", index)) {
      index = copyBlockComment(sql, index, output);
      continue;
    }

    const dollarDelimiter = readDollarQuoteDelimiter(sql, index);
    if (dollarDelimiter) {
      index = copyDollarQuotedToken(sql, index, dollarDelimiter, output);
      continue;
    }

    const open = sql[index];
    if (open === '"' || open === "`" || open === "[") {
      const close = open === "[" ? "]" : open;
      const end = findQuotedTokenEnd(sql, index, close, false);
      if (end !== -1) {
        const value = sql.slice(index + 1, end);
        output.push(
          isSimpleIdentifier(value) && !isReservedKeyword(value)
            ? value
            : sql.slice(index, end + 1)
        );
        index = end + 1;
        continue;
      }
    }

    output.push(sql[index]!);
    index += 1;
  }

  return output.join("");
}

function copyQuotedToken(
  sql: string,
  start: number,
  close: string,
  output: string[],
  backslashEscapes: boolean
): number {
  const end = findQuotedTokenEnd(sql, start, close, backslashEscapes);
  const next = end === -1 ? sql.length : end + 1;
  output.push(sql.slice(start, next));
  return next;
}

function findQuotedTokenEnd(
  sql: string,
  start: number,
  close: string,
  backslashEscapes: boolean
): number {
  for (let index = start + 1; index < sql.length; index += 1) {
    if (backslashEscapes && sql[index] === "\\") {
      index += 1;
      continue;
    }
    if (sql[index] !== close) continue;
    if (sql[index + 1] === close) {
      index += 1;
      continue;
    }
    return index;
  }
  return -1;
}

function copyLineComment(sql: string, start: number, output: string[]): number {
  const newline = sql.indexOf("\n", start + 2);
  const next = newline === -1 ? sql.length : newline;
  output.push(sql.slice(start, next));
  return next;
}

function copyBlockComment(sql: string, start: number, output: string[]): number {
  const close = sql.indexOf("*/", start + 2);
  const next = close === -1 ? sql.length : close + 2;
  output.push(sql.slice(start, next));
  return next;
}

function readDollarQuoteDelimiter(sql: string, start: number): string | null {
  if (sql[start] !== "$") return null;
  const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(start));
  return match?.[0] ?? null;
}

function copyDollarQuotedToken(
  sql: string,
  start: number,
  delimiter: string,
  output: string[]
): number {
  const close = sql.indexOf(delimiter, start + delimiter.length);
  const next = close === -1 ? sql.length : close + delimiter.length;
  output.push(sql.slice(start, next));
  return next;
}

function isSimpleIdentifier(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value);
}

function isReservedKeyword(value: string): boolean {
  return RESERVED_KEYWORDS.has(value.toLowerCase());
}
