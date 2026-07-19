import { internalCteLabel, isInternalCteName, type InternalCteName, type SqlIdentifier } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { AstIdentifierExpr, SqlRenderContext } from "./types.ts";

export function renderIdentifier(
  identifier: SqlIdentifier | null,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): string | AstIdentifierExpr | null {
  if (!identifier) return null;
  const resolvedName = resolveIdentifierName(identifier.name, renderContext);
  if (!identifier.quoted) return resolvedName;
  return quotedIdentifierExpr(resolvedName, dialect);
}

export function registerIdentifierBinding(
  bindingName: string | null | undefined,
  identifier: SqlIdentifier | null,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): void {
  if (!bindingName || !identifier?.quoted || !renderContext) return;
  renderContext.identifierBindings[bindingName] = quotedIdentifierExpr(identifier.name, dialect);
}

export function registerColumnIdentifierBinding(
  tableAlias: string | null | undefined,
  bindingName: string | null | undefined,
  identifier: SqlIdentifier,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): void {
  if (!tableAlias || !bindingName || !renderContext) return;
  if (!identifier.quoted && identifier.name === bindingName) return;
  const rendered = renderIdentifier(identifier, dialect, renderContext);
  if (!rendered) return;
  renderContext.columnIdentifierBindings[`${tableAlias}.${bindingName}`] =
    typeof rendered === "string" ? rendered : { expr: rendered };
}

export function registerColumnIdentifierBindings(
  tableAlias: string | null | undefined,
  identifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): void {
  if (!tableAlias || !renderContext) return;
  for (const [name, identifier] of Object.entries(identifiers)) {
    registerColumnIdentifierBinding(tableAlias, name, identifier, dialect, renderContext);
  }
}

export function renderSourceSql(
  parts: {
    db: SqlIdentifier | null;
    schema: SqlIdentifier | null;
    table: SqlIdentifier;
  },
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): string {
  return [parts.db, parts.schema, parts.table]
    .filter((part): part is SqlIdentifier => part !== null)
    .map((part) => {
      const name = resolveIdentifierName(part.name, renderContext);
      return part.quoted ? quoteIdentifier(name, dialect) : name;
    })
    .join(".");
}

/** Register a declared CTE name for this render without treating table names as CTEs. */
export function registerCteNameBinding(
  name: InternalCteName | string,
  renderContext: SqlRenderContext | null
): string {
  if (!renderContext) return name;
  const existing = renderContext.cteNameBindings[name];
  if (existing) return existing;
  const label = isInternalCteName(name) ? (internalCteLabel(name) ?? "derived") : name;
  const rendered = isInternalCteName(name)
    ? `${label}_${renderContext.nextInternalCteIndex++}`
    : name;
  renderContext.cteNameBindings[name] = rendered;
  return rendered;
}

export function resolveIdentifierName(
  name: string,
  renderContext: SqlRenderContext | null
): string {
  if (!renderContext) return name;
  return renderContext.cteNameBindings[name] ?? name;
}

function quotedIdentifierExpr(name: string, dialect: QueryDialect): AstIdentifierExpr {
  return {
    type: "default",
    value: quoteIdentifier(name, dialect),
  };
}

function quoteIdentifier(name: string, dialect: QueryDialect): string {
  if (isBigQueryDialect(dialect)) {
    return `\`${escapeBigQueryIdentifier(name)}\``;
  }
  const [open, close] = identifierDelimiters(dialect);
  return `${open}${escapeIdentifier(name, open, close)}${close}`;
}

function identifierDelimiters(dialect: QueryDialect): [string, string] {
  const key = (dialect.parserDialect ?? dialect.name).toLowerCase();
  switch (key) {
    case "mysql":
    case "mariadb":
      return ["`", "`"];
    case "transactsql":
      return ["[", "]"];
    default:
      return ['"', '"'];
  }
}

function isBigQueryDialect(dialect: QueryDialect): boolean {
  return (dialect.parserDialect ?? dialect.name).toLowerCase() === "bigquery";
}

function escapeBigQueryIdentifier(name: string): string {
  return name
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\x60");
}

function escapeIdentifier(name: string, open: string, close: string): string {
  const delimiter = open === close ? open : close;
  return name.replace(
    new RegExp(escapeRegExp(delimiter), "g"),
    `${delimiter}${delimiter}`
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
