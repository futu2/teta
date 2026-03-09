import { internalCteLabel, isInternalCteName, type SqlIdentifier } from "../../core/types";
import type { QueryDialect } from "../types";
import type { AstIdentifierExpr, SqlRenderContext } from "./types";

const QUOTED_IDENTIFIER_PREFIX = "__TETA_QI_";

export function renderIdentifier(
  identifier: SqlIdentifier | null,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): string | AstIdentifierExpr | null {
  if (!identifier) return null;
  const resolvedName = resolveIdentifierName(identifier.name, renderContext);
  if (!identifier.quoted) return resolvedName;
  if (renderContext?.mode === "ast") {
    return quotedIdentifierExpr(resolvedName, dialect);
  }
  if (!renderContext) return resolvedName;

  const token = `${QUOTED_IDENTIFIER_PREFIX}${renderContext.quotedIdentifiers.length}__`;
  renderContext.quotedIdentifiers.push({
    token,
    sql: quoteIdentifier(resolvedName, dialect),
  });
  return token;
}

export function registerIdentifierBinding(
  bindingName: string | null | undefined,
  identifier: SqlIdentifier | null,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): void {
  if (!bindingName || !identifier?.quoted || renderContext?.mode !== "ast") return;
  renderContext.identifierBindings[bindingName] = quotedIdentifierExpr(identifier.name, dialect);
}

export function registerColumnIdentifierBinding(
  tableAlias: string | null | undefined,
  bindingName: string | null | undefined,
  identifier: SqlIdentifier,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null
): void {
  if (!tableAlias || !bindingName || !identifier.quoted || !renderContext) return;
  const rendered = renderIdentifier(identifier, dialect, renderContext);
  if (!rendered) return;
  renderContext.columnIdentifierBindings[`${tableAlias}.${bindingName}`] = rendered;
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

export function resolveIdentifierName(
  name: string,
  renderContext: SqlRenderContext | null
): string {
  if (!renderContext || !isInternalCteName(name)) return name;
  const existing = renderContext.cteNameBindings[name];
  if (existing) return existing;
  const label = internalCteLabel(name) ?? "cte";
  const rendered = `${label}_${renderContext.nextInternalCteIndex++}`;
  renderContext.cteNameBindings[name] = rendered;
  return rendered;
}

export function restoreQuotedIdentifiers(
  sql: string,
  renderContext: SqlRenderContext
): string {
  let restored = sql;
  for (const item of renderContext.quotedIdentifiers) {
    const token = escapeRegExp(item.token);
    restored = restored
      .replace(new RegExp(`"${token}"`, "g"), item.sql)
      .replace(new RegExp("`" + token + "`", "g"), item.sql)
      .replace(new RegExp("\\[" + token + "\\]", "g"), item.sql)
      .replace(new RegExp(`\\b${token}\\b`, "g"), item.sql);
  }
  return restored;
}

function quotedIdentifierExpr(name: string, dialect: QueryDialect): AstIdentifierExpr {
  return {
    type: "default",
    value: quoteIdentifier(name, dialect),
  };
}

function quoteIdentifier(name: string, dialect: QueryDialect): string {
  const [open, close] = identifierDelimiters(dialect);
  return `${open}${escapeIdentifier(name, open, close)}${close}`;
}

function identifierDelimiters(dialect: QueryDialect): [string, string] {
  const key = (dialect.parserDialect ?? dialect.name).toLowerCase();
  switch (key) {
    case "mysql":
    case "mariadb":
    case "bigquery":
      return ["`", "`"];
    case "transactsql":
      return ["[", "]"];
    default:
      return ['"', '"'];
  }
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
