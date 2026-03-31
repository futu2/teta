const PRETTY_KEYWORDS = [
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
  "UNION ALL",
  "UNION",
  "ORDER BY",
  "LIMIT",
  "ON",
];

const MAIN_QUERY_KEYWORDS = new Set(["SELECT", "INSERT", "UPDATE", "DELETE"]);
const WITH_KEYWORDS = new Set(["WITH", "WITH RECURSIVE"]);
const CTE_INDENT = "  ";
const CTE_BODY_INDENT = "  ";

export function formatSqlPretty(sql: string): string {
  const orderedKeywords = [...PRETTY_KEYWORDS].sort((left, right) => right.length - left.length);
  const state: PrettyFormatState = {
    out: "",
    index: 0,
    inSingle: false,
    inDouble: false,
    inBacktick: false,
    inBracket: false,
    parenDepth: 0,
    inWith: false,
  };

  while (state.index < sql.length) {
    const ch = sql[state.index]!;

    if (consumeQuotedBoundary(state, ch)) {
      continue;
    }

    if (!isInsideQuotedSection(state)) {
      if (consumeWithSeparator(sql, state, ch)) {
        continue;
      }
      if (consumeKeyword(sql, state, orderedKeywords)) {
        continue;
      }
    }

    state.out += ch;
    state.index += 1;
    updateParenDepth(state, ch);
  }

  return state.out.replace(/[ \t]+\n/g, "\n").trim();
}

type PrettyFormatState = {
  out: string;
  index: number;
  inSingle: boolean;
  inDouble: boolean;
  inBacktick: boolean;
  inBracket: boolean;
  parenDepth: number;
  inWith: boolean;
};

function consumeQuotedBoundary(state: PrettyFormatState, ch: string): boolean {
  if (!state.inDouble && !state.inBacktick && !state.inBracket && ch === "'") {
    state.inSingle = !state.inSingle;
    state.out += ch;
    state.index += 1;
    return true;
  }
  if (!state.inSingle && !state.inBacktick && !state.inBracket && ch === '"') {
    state.inDouble = !state.inDouble;
    state.out += ch;
    state.index += 1;
    return true;
  }
  if (!state.inSingle && !state.inDouble && !state.inBracket && ch === "`") {
    state.inBacktick = !state.inBacktick;
    state.out += ch;
    state.index += 1;
    return true;
  }
  if (!state.inSingle && !state.inDouble && !state.inBacktick && ch === "[") {
    state.inBracket = true;
    state.out += ch;
    state.index += 1;
    return true;
  }
  if (state.inBracket && ch === "]") {
    state.inBracket = false;
    state.out += ch;
    state.index += 1;
    return true;
  }
  return false;
}

function consumeWithSeparator(
  sql: string,
  state: PrettyFormatState,
  ch: string
): boolean {
  if (!(state.inWith && state.parenDepth === 0 && ch === ",")) {
    return false;
  }

  trimTrailingSpacesIfContent(state);
  state.out += ",";
  state.index += 1;
  while (state.index < sql.length && (sql[state.index] === " " || sql[state.index] === "\t")) {
    state.index += 1;
  }
  appendNewline(state, getIndent(true, state.parenDepth));
  return true;
}

function consumeKeyword(
  sql: string,
  state: PrettyFormatState,
  orderedKeywords: string[]
): boolean {
  const match = matchKeyword(sql, state.index, orderedKeywords);
  if (!match) return false;

  const upper = match.text.toUpperCase();
  const isWithKeyword = WITH_KEYWORDS.has(upper);
  let nextInWith = state.inWith;
  if (state.parenDepth === 0) {
    if (isWithKeyword) nextInWith = true;
    else if (state.inWith && MAIN_QUERY_KEYWORDS.has(upper)) nextInWith = false;
  }

  const lineInWith = isWithKeyword ? false : nextInWith;
  appendNewline(state, getIndent(lineInWith, state.parenDepth));
  state.out += match.text;
  state.index += match.length;
  state.inWith = nextInWith;

  if (isWithKeyword && state.parenDepth === 0) {
    appendNewline(state, getIndent(true, state.parenDepth));
    while (state.index < sql.length && (sql[state.index] === " " || sql[state.index] === "\t")) {
      state.index += 1;
    }
  }

  return true;
}

function appendNewline(state: PrettyFormatState, indent: string): void {
  trimTrailingSpacesIfContent(state);
  if (state.out.length > 0 && !isLineStart(state.out)) {
    state.out += "\n";
  }
  if (indent) {
    state.out += indent;
  }
}

function getIndent(lineInWith: boolean, parenDepth: number): string {
  if (!lineInWith) return "";
  return parenDepth > 0 ? CTE_INDENT + CTE_BODY_INDENT : CTE_INDENT;
}

function trimTrailingSpacesIfContent(state: PrettyFormatState): void {
  const idx = state.out.lastIndexOf("\n");
  const tail = idx === -1 ? state.out : state.out.slice(idx + 1);
  if (/[^ \t]/.test(tail)) {
    state.out = state.out.replace(/[ \t]+$/g, "");
  }
}

function isLineStart(text: string): boolean {
  const idx = text.lastIndexOf("\n");
  const tail = idx === -1 ? text : text.slice(idx + 1);
  return /^[ \t]*$/.test(tail);
}

function updateParenDepth(state: PrettyFormatState, ch: string): void {
  if (isInsideQuotedSection(state)) return;
  if (ch === "(") state.parenDepth += 1;
  else if (ch === ")" && state.parenDepth > 0) state.parenDepth -= 1;
}

function isInsideQuotedSection(state: PrettyFormatState): boolean {
  return state.inSingle || state.inDouble || state.inBacktick || state.inBracket;
}

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
