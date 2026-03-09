import type {
  ColumnType,
  InferSchema,
  SqlIdentifier,
  TableSourceInput,
} from "../core/types";
import { createColumnRefs } from "../expr";
import type {
  SqlDate,
  SqlFloat,
  SqlInt,
  SqlTimestamp,
} from "../sql/types";
import type { Query } from "./builder";
import { createQuery } from "./builder";
import { freshScopeId } from "./planner";
import {
  normalizeIdentifier,
  normalizeTableSource,
} from "./utils";

/** Column type helpers for table schemas. */
export function ident<const Name extends string>(name: Name): SqlIdentifier<Name> {
  return normalizeIdentifier({ name, quoted: true }, "identifier");
}

export const t = {
  string: () => ({ kind: "column_type" } as ColumnType<string>),
  int: () => ({ kind: "column_type" } as ColumnType<SqlInt>),
  float: () => ({ kind: "column_type" } as ColumnType<SqlFloat>),
  boolean: () => ({ kind: "column_type" } as ColumnType<boolean>),
  date: () => ({ kind: "column_type" } as ColumnType<SqlDate>),
  timestamp: () => ({ kind: "column_type" } as ColumnType<SqlTimestamp>),
};

/** Define a table with a schema and return a typed query builder. */
export function table<S extends Record<string, ColumnType<any>>>(
  name: TableSourceInput,
  schema: S
): Query<InferSchema<S>> {
  const columnNames = Object.keys(schema);
  const source = normalizeTableSource(name);
  const scopeId = freshScopeId();
  return createQuery({
    source,
    stages: [],
    columns: createColumnRefs<InferSchema<S>>(scopeId, columnNames),
    columnNames,
    sourceScopeId: scopeId,
    scopeId,
  });
}
