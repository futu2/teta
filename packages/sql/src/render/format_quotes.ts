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

/** Remove identifier quotes that are not needed for parser-safe SQL. */
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
  return RESERVED_KEYWORDS.has(value.toLowerCase());
}
