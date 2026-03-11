import type {
  ColumnType,
  InferSchema,
  TableSourceInput,
} from "../core/types.ts";
import { createColumnRefs } from "../expr.ts";
import type {
  SqlBigInt,
  SqlBytes,
  SqlDate,
  SqlDecimal,
  SqlFloat,
  SqlInt,
  SqlJson,
  SqlTimestamp,
  SqlUuid,
} from "../sql/types.ts";
import type { Query } from "./builder.ts";
import { createQuery } from "./builder.ts";
import { freshScopeId } from "./planner.ts";
import { normalizeTableSource } from "./utils.ts";

export const t = {
  string: () => ({ kind: "column_type" } as ColumnType<string>),
  int: () => ({ kind: "column_type" } as ColumnType<SqlInt>),
  float: () => ({ kind: "column_type" } as ColumnType<SqlFloat>),
  bigint: () => ({ kind: "column_type" } as ColumnType<SqlBigInt>),
  decimal: () => ({ kind: "column_type" } as ColumnType<SqlDecimal>),
  boolean: () => ({ kind: "column_type" } as ColumnType<boolean>),
  date: () => ({ kind: "column_type" } as ColumnType<SqlDate>),
  timestamp: () => ({ kind: "column_type" } as ColumnType<SqlTimestamp>),
  uuid: () => ({ kind: "column_type" } as ColumnType<SqlUuid>),
  json: <T = unknown>() => ({ kind: "column_type" } as ColumnType<SqlJson<T>>),
  bytes: () => ({ kind: "column_type" } as ColumnType<SqlBytes>),
  array: <T>(column: ColumnType<T>) => {
    void column;
    return { kind: "column_type" } as ColumnType<T[]>;
  },
  nullable: <T>(column: ColumnType<T>): ColumnType<T | null> => {
    void column;
    return { kind: "column_type" } as ColumnType<T | null>;
  },
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
