import type {
  ColumnType,
  ColumnTypeName,
  InferSchema,
  TableSourceInput,
  Value,
} from "../core/types.ts";
import { createColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import type {
  NormalizeExpressionLiteral,
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

type ValuesRow = Readonly<Record<string, Value>>;
type ValuesColumns<TRows extends readonly ValuesRow[]> = {
  [K in keyof TRows[number] & string]: NormalizeExpressionLiteral<TRows[number][K]>;
};

type TableColumnHelpers = {
  string: () => ColumnType<string>;
  int: () => ColumnType<SqlInt>;
  float: () => ColumnType<SqlFloat>;
  bigint: () => ColumnType<SqlBigInt>;
  decimal: () => ColumnType<SqlDecimal>;
  boolean: () => ColumnType<boolean>;
  date: () => ColumnType<SqlDate>;
  timestamp: () => ColumnType<SqlTimestamp>;
  uuid: () => ColumnType<SqlUuid>;
  json: <T = unknown>() => ColumnType<SqlJson<T>>;
  bytes: () => ColumnType<SqlBytes>;
  array: <T>(column: ColumnType<T>) => ColumnType<T[]>;
  nullable: <T>(column: ColumnType<T>) => ColumnType<T | null>;
};

export const t: TableColumnHelpers = {
  string: () => columnType<string>("string"),
  int: () => columnType<SqlInt>("int"),
  float: () => columnType<SqlFloat>("float"),
  bigint: () => columnType<SqlBigInt>("bigint"),
  decimal: () => columnType<SqlDecimal>("decimal"),
  boolean: () => columnType<boolean>("boolean"),
  date: () => columnType<SqlDate>("date"),
  timestamp: () => columnType<SqlTimestamp>("timestamp"),
  uuid: () => columnType<SqlUuid>("uuid"),
  json: <T = unknown>() => columnType<SqlJson<T>>("json"),
  bytes: () => columnType<SqlBytes>("bytes"),
  array: <T>(column: ColumnType<T>): ColumnType<T[]> => {
    return columnType<T[]>("array", { arrayOf: column as ColumnType<unknown> });
  },
  nullable: <T>(column: ColumnType<T>): ColumnType<T | null> => {
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

/** Define an inline row set and return a typed query builder. */
export function values<const TRows extends readonly [ValuesRow, ...ValuesRow[]]>(
  rows: TRows
): Query<ValuesColumns<TRows>> {
  const normalizedRows = normalizeValuesRows(rows);
  const columnNames = Object.keys(normalizedRows[0]!);
  const scopeId = freshScopeId();
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
