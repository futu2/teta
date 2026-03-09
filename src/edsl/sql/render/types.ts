import type { Select } from "node-sql-parser";
import type { SqlParam, SqlParameterMode, SqlParameterPrefix } from "../types";

export type SelectAst = Omit<
  Select,
  "columns" | "from" | "where" | "groupby" | "having" | "qualify" | "orderby" | "limit" | "options" | "window"
> & {
  columns: unknown;
  from: unknown[] | unknown | null;
  where: unknown | null;
  groupby: unknown | null;
  having: unknown | null;
  qualify?: unknown | null;
  orderby: unknown | null;
  limit: unknown | null;
  options: unknown[] | null;
  window?: unknown;
  into?: { position: null };
  locking_read?: null;
  collate?: null;
};

export type AstIdentifierExpr = {
  type: "default";
  value: string;
};

export type BaseFromRef = {
  db?: string | null;
  schema?: string | null;
  table?: string;
  rawTable?: string | null;
  as: string | AstIdentifierExpr | null;
  rawAlias?: string | null;
  expr?: unknown;
  type?: string;
};

export type ScopeBindings = Readonly<Record<string, string | null>>;

export type SqlRenderContext = {
  mode: "sql" | "ast";
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
  params: SqlParam[];
  quotedIdentifiers: Array<{ token: string; sql: string }>;
  identifierBindings: Record<string, AstIdentifierExpr>;
  columnIdentifierBindings: Record<string, string | AstIdentifierExpr>;
  cteNameBindings: Record<string, string>;
  nextInternalCteIndex: number;
};
