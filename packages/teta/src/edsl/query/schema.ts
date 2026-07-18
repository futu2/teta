import type {
  ColumnType,
  ColumnTypeName,
  TableSourceInput,
  Value,
} from "../core/types.ts";
import { createColumnRefs, toExprNode, type ExprInput } from "../expr.ts";
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
import { createStringRecord, setStringRecordValue } from "../record.ts";

type ValuesInput = Value | bigint;
type ValuesRow = Readonly<Record<string, ValuesInput>>;
type NormalizedValuesRow = Readonly<Record<string, Value>>;
type ValuesColumns<TRows extends readonly ValuesRow[]> = {
  [K in keyof TRows[number] & string]: NormalizeExpressionLiteral<TRows[number][K]>;
};
type MatchingValuesRows<TRows extends readonly [ValuesRow, ...ValuesRow[]]> = {
  readonly [TIndex in keyof TRows]: TRows[TIndex] extends ValuesRow
    ? Exclude<keyof TRows[0], keyof TRows[TIndex]> extends never
      ? Exclude<keyof TRows[TIndex], keyof TRows[0]> extends never
        ? TRows[TIndex]
        : never
      : never
    : never;
};

export type SqlType<TExpression, TInput, TOutput = TInput> = ColumnType<TExpression> & Readonly<{
  encode: (value: TInput) => unknown;
  decode: (value: unknown) => TOutput;
  readonly __input?: TInput;
  readonly __output?: TOutput;
}>;

export type ExpressionOf<TType> = TType extends SqlType<infer TExpression, any, any>
  ? TExpression
  : never;
export type InputOf<TType> = TType extends SqlType<any, infer TInput, any> ? TInput : never;
export type OutputOf<TType> = TType extends SqlType<any, any, infer TOutput> ? TOutput : never;

export type DriverValue<T> =
  T extends null ? null
  : T extends SqlInt | SqlFloat | SqlDecimal ? number
  : T extends SqlBigInt ? bigint
  : T extends SqlBoolean ? boolean
  : T extends SqlDate | SqlTimestamp | SqlUuid | SqlString ? string
  : T extends SqlBytes ? Uint8Array
  : T extends readonly (infer TItem)[] ? readonly DriverValue<TItem>[]
  : T extends SqlJson<infer TJson> ? TJson
  : T;

export type RowOf<TQuery> = TQuery extends Query<infer TColumns>
  ? { readonly [K in keyof TColumns]: DriverValue<TColumns[K]> }
  : TQuery extends { readonly query: Query<infer TColumns> }
    ? { readonly [K in keyof TColumns]: DriverValue<TColumns[K]> }
    : never;

export type TableColumnHelpers = {
  string: () => SqlType<SqlString, string>;
  int: () => SqlType<SqlInt, number>;
  float: () => SqlType<SqlFloat, number>;
  bigint: () => SqlType<SqlBigInt, bigint>;
  decimal: () => SqlType<SqlDecimal, number>;
  boolean: () => SqlType<SqlBoolean, boolean>;
  date: () => SqlType<SqlDate, string>;
  timestamp: () => SqlType<SqlTimestamp, string>;
  uuid: () => SqlType<SqlUuid, string>;
  json: <T = unknown>() => SqlType<SqlJson<T>, T>;
  bytes: () => SqlType<SqlBytes, Uint8Array>;
  array: <TExpression, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ) => SqlType<readonly TExpression[], readonly TInput[], readonly TOutput[]>;
  nullable: <TExpression, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ) => SqlType<TExpression | null, TInput | null, TOutput | null>;
};

export const t: TableColumnHelpers = Object.freeze({
  string: () => scalarType<SqlString, string>("string", isString),
  int: () => scalarType<SqlInt, number>("int", isInteger),
  float: () => scalarType<SqlFloat, number>("float", isFiniteNumber),
  bigint: () => scalarType<SqlBigInt, bigint>("bigint", isBigInt),
  decimal: () => scalarType<SqlDecimal, number>("decimal", isFiniteNumber),
  boolean: () => scalarType<SqlBoolean, boolean>("boolean", isBoolean),
  date: () => scalarType<SqlDate, string>("date", isString),
  timestamp: () => scalarType<SqlTimestamp, string>("timestamp", isString),
  uuid: () => scalarType<SqlUuid, string>("uuid", isString),
  json: <T = unknown>() => scalarType<SqlJson<T>, T>(
    "json",
    ((value: unknown): value is T => value !== undefined)
  ),
  bytes: () => scalarType<SqlBytes, Uint8Array>("bytes", isBytes),
  array: <TExpression, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ): SqlType<readonly TExpression[], readonly TInput[], readonly TOutput[]> => {
    assertColumnType("t.array", column);
    return sqlType("array", false, column as SqlType<unknown, unknown, unknown>,
      (value: readonly TInput[]) => {
        if (!Array.isArray(value)) invalidDescriptorValue("array", value);
        return value.map((item) => column.encode(item));
      },
      (value: unknown) => {
        if (!Array.isArray(value)) invalidDescriptorValue("array", value);
        return value.map((item) => column.decode(item));
      });
  },
  nullable: <TExpression, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ): SqlType<TExpression | null, TInput | null, TOutput | null> => {
    assertColumnType("t.nullable", column);
    return sqlType(column.type, true, column.arrayOf as SqlType<unknown, unknown, unknown> | undefined,
      (value: TInput | null) => value === null ? null : column.encode(value),
      (value: unknown) => value === null ? null : column.decode(value));
  },
});

function scalarType<TExpression, TValue>(
  type: ColumnTypeName,
  validate: (value: unknown) => value is TValue
): SqlType<TExpression, TValue> {
  return sqlType(type, false, undefined,
    (value: TValue) => {
      if (!validate(value)) invalidDescriptorValue(type, value);
      return value;
    },
    (value: unknown) => {
      if (!validate(value)) invalidDescriptorValue(type, value);
      return value;
    });
}

function sqlType<TExpression, TInput, TOutput>(
  type: ColumnTypeName,
  nullable: boolean,
  arrayOf: SqlType<unknown, unknown, unknown> | undefined,
  encode: (value: TInput) => unknown,
  decode: (value: unknown) => TOutput
): SqlType<TExpression, TInput, TOutput> {
  return Object.freeze({
    kind: "column_type" as const,
    type,
    nullable,
    ...(arrayOf === undefined ? {} : { arrayOf }),
    encode,
    decode,
  }) as SqlType<TExpression, TInput, TOutput>;
}

/** Define a table with a schema and return a typed query builder. */
export type TableSchema = Record<string, SqlType<any, any, any>>;
type RequireNonEmptySchema<S extends TableSchema> =
  keyof S extends never
    ? { __teta_table_schema_requires_columns__: never }
    : unknown;
type InferQuerySchema<S extends TableSchema> = {
  [K in keyof S]: ExpressionOf<S[K]> extends infer T extends QueryValue ? T : never;
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
  rows: TRows & MatchingValuesRows<TRows>
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

function normalizeValuesRows(rows: readonly ValuesRow[]): readonly NormalizedValuesRow[] {
  if (rows.length === 0) {
    userError("VALUES_EMPTY", "values() requires at least one row");
  }

  const firstRow = rows[0]!;
  assertValuesRow(firstRow, 0);
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

export function assertColumnType(
  helper: string,
  value: unknown
): asserts value is SqlType<QueryValue, unknown, unknown> {
  if (!isColumnType(value)) {
    userError("TABLE_SCHEMA_INVALID", `${helper}() expects a column type`);
  }
}

export function isColumnType(value: unknown): value is SqlType<QueryValue, unknown, unknown> {
  if (!isPlainObject(value)) return false;
  if (value.kind !== "column_type") return false;
  if (!isColumnTypeName(value.type)) return false;
  if (typeof value.nullable !== "boolean") return false;
  if (value.arrayOf !== undefined && !isColumnType(value.arrayOf)) return false;
  return typeof value.encode === "function" && typeof value.decode === "function";
}

function invalidDescriptorValue(type: ColumnTypeName, value: unknown): never {
  userError("INVALID_PARAM_VALUE", `Expected ${type} value, received ${describeValue(value)}`);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBigInt(value: unknown): value is bigint {
  return typeof value === "bigint";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
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
): NormalizedValuesRow {
  assertValuesRow(row, rowIndex);
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

  const normalizedRow = createStringRecord<Value>();
  for (const columnName of columnNames) {
    const value = row[columnName];
    if (value === undefined) {
      userError(
        "VALUES_UNDEFINED",
        `values() row ${rowIndex + 1} column '${columnName}' cannot be undefined`
      );
    }
    const node = toExprNode(value as ExprInput<unknown>);
    if (node.kind !== "literal") {
      userError(
        "INVALID_LITERAL_VALUE",
        `values() row ${rowIndex + 1} column '${columnName}' must be a literal value`
      );
    }
    setStringRecordValue(normalizedRow, columnName, node.value);
  }

  return normalizedRow;
}

function assertValuesRow(value: unknown, rowIndex: number): asserts value is ValuesRow {
  if (!isPlainObject(value)) {
    userError("VALUES_ROW_INVALID", `values() row ${rowIndex + 1} must be an object`);
  }
}
