import type {
  ColumnType,
  ColumnTypeName,
  TableSourceInput,
  Value,
} from "../core/types.ts";
import { createColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import type {
  NormalizeExpressionLiteral,
  SqlBigInt,
  SqlBoolean,
  SqlBytes,
  SqlDate,
  SqlDecimal,
  SqlFloat,
  SqlInt,
  SqlJson,
  SqlString,
  SqlTimestamp,
  SqlUuid,
} from "../sql/types.ts";
import type { Query } from "./core.ts";
import { createQuery } from "./core.ts";
import { initialScopeId, reserveQueryScopes } from "./planner.ts";
import type { QueryValue } from "./types.ts";
import { normalizeTableSource } from "./utils.ts";
import { isPlainObject } from "./value.ts";

type ValuesRow = Readonly<Record<string, Value>>;
type ValuesColumns<TRows extends readonly ValuesRow[]> = {
  [K in keyof TRows[number] & string]: NormalizeExpressionLiteral<TRows[number][K]>;
};

type TableColumnHelpers = {
  string: () => ColumnType<SqlString>;
  int: () => ColumnType<SqlInt>;
  float: () => ColumnType<SqlFloat>;
  bigint: () => ColumnType<SqlBigInt>;
  decimal: () => ColumnType<SqlDecimal>;
  boolean: () => ColumnType<SqlBoolean>;
  date: () => ColumnType<SqlDate>;
  timestamp: () => ColumnType<SqlTimestamp>;
  uuid: () => ColumnType<SqlUuid>;
  json: <T = unknown>() => ColumnType<SqlJson<T>>;
  bytes: () => ColumnType<SqlBytes>;
  array: <T>(column: ColumnType<T>) => ColumnType<T[]>;
  nullable: <T>(column: ColumnType<T>) => ColumnType<T | null>;
};

export const t: TableColumnHelpers = {
  string: () => columnType<SqlString>("string"),
  int: () => columnType<SqlInt>("int"),
  float: () => columnType<SqlFloat>("float"),
  bigint: () => columnType<SqlBigInt>("bigint"),
  decimal: () => columnType<SqlDecimal>("decimal"),
  boolean: () => columnType<SqlBoolean>("boolean"),
  date: () => columnType<SqlDate>("date"),
  timestamp: () => columnType<SqlTimestamp>("timestamp"),
  uuid: () => columnType<SqlUuid>("uuid"),
  json: <T = unknown>() => columnType<SqlJson<T>>("json"),
  bytes: () => columnType<SqlBytes>("bytes"),
  array: <T>(column: ColumnType<T>): ColumnType<T[]> => {
    assertColumnType("t.array", column);
    return columnType<T[]>("array", { arrayOf: column as ColumnType<unknown> });
  },
  nullable: <T>(column: ColumnType<T>): ColumnType<T | null> => {
    assertColumnType("t.nullable", column);
    return {
      ...column,
      nullable: true,
    } as ColumnType<T | null>;
  },
};

function columnType<T>(
  type: ColumnTypeName,
  options: { arrayOf?: ColumnType<unknown> } = {}
): ColumnType<T> {
  return Object.freeze({
    kind: "column_type" as const,
    type,
    nullable: false,
    ...options,
  }) as ColumnType<T>;
}

/** Define a table with a schema and return a typed query builder. */
type TableSchema = Record<string, ColumnType<QueryValue>>;
type RequireNonEmptySchema<S extends TableSchema> =
  keyof S extends never
    ? { __teta_table_schema_requires_columns__: never }
    : unknown;
type InferQuerySchema<S extends TableSchema> = {
  [K in keyof S]: S[K] extends ColumnType<infer T extends QueryValue> ? T : never;
};

export function table<S extends TableSchema>(
  name: TableSourceInput,
  schema: S & RequireNonEmptySchema<S>
): Query<InferQuerySchema<S>> {
  assertTableSchema(schema);
  const columnNames = Object.keys(schema);
  const source = normalizeTableSource(name);
  const scopeId = initialScopeId();
  return createQuery({
    source,
    stages: [],
    columns: createColumnRefs<InferQuerySchema<S>>(scopeId, columnNames),
    columnNames,
    sourceScopeId: scopeId,
    scopeId,
    nameSupply: reserveQueryScopes(1),
  });
}

/** Define an inline row set and return a typed query builder. */
export function values<const TRows extends readonly [ValuesRow, ...ValuesRow[]]>(
  rows: TRows
): Query<ValuesColumns<TRows>> {
  const normalizedRows = normalizeValuesRows(rows);
  const columnNames = Object.keys(normalizedRows[0]!);
  const scopeId = initialScopeId();
  return createQuery({
    source: {
      kind: "values",
      rows: normalizedRows,
    },
    stages: [],
    columns: createColumnRefs<ValuesColumns<TRows>>(scopeId, columnNames),
    columnNames,
    sourceScopeId: scopeId,
    scopeId,
    nameSupply: reserveQueryScopes(1),
  });
}

function normalizeValuesRows(rows: readonly ValuesRow[]): readonly ValuesRow[] {
  if (rows.length === 0) {
    userError("VALUES_EMPTY", "values() requires at least one row");
  }

  const firstRow = rows[0]!;
  const columnNames = Object.keys(firstRow);
  if (columnNames.length === 0) {
    userError("VALUES_NO_COLUMNS", "values() rows must define at least one column");
  }

  return rows.map((row, rowIndex) => normalizeValuesRow(row, rowIndex, columnNames));
}

function assertTableSchema(value: unknown): asserts value is TableSchema {
  if (!isPlainObject(value)) {
    userError("TABLE_SCHEMA_INVALID", "table() schema must be a non-empty object of column types");
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    userError("TABLE_SCHEMA_EMPTY", "table() schema must define at least one column");
  }

  for (const [name, column] of entries) {
    if (!isColumnType(column)) {
      userError("TABLE_SCHEMA_INVALID", `table() schema column '${name}' must be a column type`);
    }
  }
}

function assertColumnType(helper: string, value: unknown): asserts value is ColumnType<QueryValue> {
  if (!isColumnType(value)) {
    userError("TABLE_SCHEMA_INVALID", `${helper}() expects a column type`);
  }
}

function isColumnType(value: unknown): value is ColumnType<QueryValue> {
  if (!isPlainObject(value)) return false;
  if (value.kind !== "column_type") return false;
  if (!isColumnTypeName(value.type)) return false;
  if (typeof value.nullable !== "boolean") return false;
  if (value.arrayOf !== undefined && !isColumnType(value.arrayOf)) return false;
  return true;
}

function isColumnTypeName(value: unknown): value is ColumnTypeName {
  return value === "string"
    || value === "int"
    || value === "float"
    || value === "bigint"
    || value === "decimal"
    || value === "boolean"
    || value === "date"
    || value === "timestamp"
    || value === "uuid"
    || value === "json"
    || value === "bytes"
    || value === "array";
}

function normalizeValuesRow(
  row: ValuesRow,
  rowIndex: number,
  columnNames: readonly string[]
): ValuesRow {
  const rowKeys = Object.keys(row);
  const hasSameColumns =
    rowKeys.length === columnNames.length
    && columnNames.every((columnName) => rowKeys.includes(columnName));

  if (!hasSameColumns) {
    userError(
      "VALUES_COLUMN_MISMATCH",
      `values() row ${rowIndex + 1} must have exactly the same columns as row 1`
    );
  }

  const normalizedRow: Record<string, Value> = {};
  for (const columnName of columnNames) {
    const value = row[columnName];
    if (value === undefined) {
      userError(
        "VALUES_UNDEFINED",
        `values() row ${rowIndex + 1} column '${columnName}' cannot be undefined`
      );
    }
    normalizedRow[columnName] = value;
  }

  return normalizedRow;
}
