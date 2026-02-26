import type { Select } from "node-sql-parser";

export type SelectAst = Omit<
  Select,
  "columns" | "from" | "where" | "groupby" | "having" | "orderby" | "limit" | "options" | "window"
> & {
  columns: unknown;
  from: unknown[] | unknown | null;
  where: unknown | null;
  groupby: unknown | null;
  having: unknown[] | null;
  orderby: unknown | null;
  limit: unknown | null;
  options: unknown[] | null;
  window?: unknown;
  into?: { position: null };
  locking_read?: null;
  collate?: null;
};

export type BaseFromRef = {
  db: null;
  schema?: string | null;
  table: string;
  as: string | null;
};
