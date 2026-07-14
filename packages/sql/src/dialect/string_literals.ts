type DialectIdentity = {
  name?: string;
  parserDialect?: string | null;
};

const BACKSLASH_STRING_DIALECTS = new Set([
  "bigquery",
  "flinksql",
  "hive",
  "mariadb",
  "mysql",
  "postgresql",
  "snowflake",
]);

/** Whether single-quoted literals recognize backslash escape sequences. */
export function usesBackslashStringEscapes(
  dialect: DialectIdentity | string | null | undefined
): boolean {
  const key = typeof dialect === "string"
    ? dialect
    : (dialect?.parserDialect ?? dialect?.name ?? "");
  return BACKSLASH_STRING_DIALECTS.has(key.toLowerCase());
}
