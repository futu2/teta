export function formatSqlPretty(sql: string): string {
  const keywords = [
    "WITH RECURSIVE",
    "WITH",
    "SELECT",
    "FROM",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "INNER JOIN",
    "JOIN",
    "WHERE",
    "GROUP BY",
    "HAVING",
    "ORDER BY",
    "LIMIT",
    "ON",
  ];
  const ordered = [...keywords].sort((a, b) => b.length - a.length);
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;
  let parenDepth = 0;
  let inWith = false;
  const mainQueryKeywords = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);
  const withKeywords = new Set(["WITH", "WITH RECURSIVE"]);
  const cteIndent = "  ";
  const cteBodyIndent = "  ";

  const isLineStart = (text: string) => {
    const idx = text.lastIndexOf("\n");
    const tail = idx === -1 ? text : text.slice(idx + 1);
    return /^[ \t]*$/.test(tail);
  };

  const trimTrailingSpacesIfContent = () => {
    const idx = out.lastIndexOf("\n");
    const tail = idx === -1 ? out : out.slice(idx + 1);
    if (/[^ \t]/.test(tail)) out = out.replace(/[ \t]+$/g, "");
  };

  const getIndent = (lineInWith: boolean) => {
    if (!lineInWith) return "";
    return parenDepth > 0 ? cteIndent + cteBodyIndent : cteIndent;
  };

  const appendNewline = (indent: string) => {
    trimTrailingSpacesIfContent();
    if (out.length > 0 && !isLineStart(out)) out += "\n";
    if (indent) out += indent;
  };

  while (i < sql.length) {
    const ch = sql[i];
    if (!inDouble && !inBacktick && !inBracket && ch === "'") {
      inSingle = !inSingle;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inBacktick && !inBracket && ch === '"') {
      inDouble = !inDouble;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && !inBracket && ch === "`") {
      inBacktick = !inBacktick;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick && ch === "[") {
      inBracket = true;
      out += ch;
      i += 1;
      continue;
    }
    if (inBracket && ch === "]") {
      inBracket = false;
      out += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      if (inWith && parenDepth === 0 && ch === ",") {
        trimTrailingSpacesIfContent();
        out += ",";
        i += 1;
        while (i < sql.length && (sql[i] === " " || sql[i] === "\t")) i += 1;
        appendNewline(getIndent(true));
        continue;
      }
      const match = matchKeyword(sql, i, ordered);
      if (match) {
        const upper = match.text.toUpperCase();
        const isWithKeyword = withKeywords.has(upper);
        let nextInWith: boolean = inWith;
        if (parenDepth === 0) {
          if (isWithKeyword) nextInWith = true;
          else if (inWith && mainQueryKeywords.has(upper)) nextInWith = false;
        }
        const lineInWith = isWithKeyword ? false : nextInWith;
        appendNewline(getIndent(lineInWith));
        out += match.text;
        i += match.length;
        inWith = nextInWith;
        if (isWithKeyword && parenDepth === 0) {
          appendNewline(getIndent(true));
          while (i < sql.length && (sql[i] === " " || sql[i] === "\t")) i += 1;
        }
        continue;
      }
    }

    out += ch;
    i += 1;
    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      if (ch === "(") parenDepth += 1;
      else if (ch === ")" && parenDepth > 0) parenDepth -= 1;
    }
  }

  return out.replace(/[ \t]+\n/g, "\n").trim();
}

export function stripRedundantQuotes(sql: string): string {
  const replacer = (full: string, id: string) => {
    if (!isSimpleIdentifier(id)) return full;
    if (isReservedKeyword(id)) return full;
    return id;
  };

  return sql
    .replace(/"([a-z0-9_]+)"/g, replacer)
    .replace(/`([a-z0-9_]+)`/g, replacer)
    .replace(/\[([a-z0-9_]+)\]/g, replacer);
}

function isSimpleIdentifier(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value);
}

function isReservedKeyword(value: string): boolean {
  const keyword = value.toLowerCase();
  return RESERVED_KEYWORDS.has(keyword);
}

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

function matchKeyword(
  sql: string,
  index: number,
  keywords: string[]
): { text: string; length: number } | null {
  for (const keyword of keywords) {
    const len = keyword.length;
    if (index + len > sql.length) continue;
    const slice = sql.slice(index, index + len);
    if (slice.toLowerCase() !== keyword.toLowerCase()) continue;
    const prev = index === 0 ? "" : (sql[index - 1] ?? "");
    const next = index + len >= sql.length ? "" : (sql[index + len] ?? "");
    if (isWordChar(prev) || isWordChar(next)) continue;
    return { text: slice, length: len };
  }
  return null;
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}
