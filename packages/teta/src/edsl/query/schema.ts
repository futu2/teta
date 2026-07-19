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
import type {
  CodecValue,
  DecodedRow,
  DriverValue as TypedDriverValue,
  InputValue,
  OutputValue,
} from "../type_system.ts";
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

/** Runtime SQL descriptor with static SQL, input, and decoded-output domains. */
export type SqlType<
  TExpression extends QueryValue,
  TInput,
  TOutput = TInput,
> = ColumnType<TExpression> & Readonly<{
  encode: (value: TInput) => unknown;
  decode: (value: unknown) => TOutput;
}>;

export type ExpressionOf<TType> = TType extends ColumnType<infer TExpression>
  ? TExpression
  : never;
export type InputOf<TType> = TType extends { encode: (value: infer TInput) => unknown }
  ? TInput
  : never;
export type OutputOf<TType> = TType extends { decode: (value: unknown) => infer TOutput }
  ? TOutput
  : never;

/** Driver-facing value inferred from a projected SQL expression. */
export type DriverValue<T> = TypedDriverValue<T>;

/** Driver-facing decoded row shape inferred from a query or prepared query. */
export type RowOf<TQuery> = TQuery extends Query<infer TColumns>
  ? DecodedRow<TColumns>
  : TQuery extends { readonly query: Query<infer TColumns> }
    ? DecodedRow<TColumns>
    : never;

/** Decoded output row corresponding to a runtime schema descriptor map. */
export type DecodedSchema<S extends TableSchema> = {
  readonly [K in keyof S]: OutputOf<S[K]>;
};

/** Decode one driver row with the exact codecs declared by a schema. */
export function decodeRow<const S extends TableSchema>(
  schema: S,
  row: Readonly<Record<string, unknown>>,
): DecodedSchema<S> {
  assertTableSchema(schema);
  if (!isPlainObject(row)) {
    userError("INVALID_PARAM_VALUE", "decodeRow() expects a row object");
  }

  const decoded = createStringRecord<unknown>();
  for (const [name, type] of Object.entries(schema)) {
    if (!Object.hasOwn(row, name)) {
      userError("INVALID_PARAM_VALUE", `decodeRow() is missing column '${name}'`);
    }
    setStringRecordValue(decoded, name, type.decode(row[name]));
  }
  return Object.freeze(decoded) as DecodedSchema<S>;
}

/** Decode a list of driver rows using one schema. */
export function decodeRows<const S extends TableSchema>(
  schema: S,
  rows: readonly Readonly<Record<string, unknown>>[],
): readonly DecodedSchema<S>[] {
  if (!Array.isArray(rows)) {
    userError("INVALID_PARAM_VALUE", "decodeRows() expects an array of row objects");
  }
  return Object.freeze(rows.map((row) => decodeRow(schema, row)));
}

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
  array: <TExpression extends QueryValue, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ) => SqlType<readonly TExpression[], readonly TInput[], readonly TOutput[]>;
  nullable: <TExpression extends QueryValue, TInput, TOutput>(
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
  array: <TExpression extends QueryValue, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ): SqlType<readonly TExpression[], readonly TInput[], readonly TOutput[]> => {
    assertColumnType("t.array", column);
    return sqlType("array", false, column as SqlType<QueryValue, never, unknown>,
      (value: readonly TInput[]) => {
        if (!Array.isArray(value)) invalidDescriptorValue("array", value);
        return value.map((item) => column.encode(item));
      },
      (value: unknown) => {
        if (!Array.isArray(value)) invalidDescriptorValue("array", value);
        return value.map((item) => column.decode(item));
      });
  },
  nullable: <TExpression extends QueryValue, TInput, TOutput>(
    column: SqlType<TExpression, TInput, TOutput>
  ): SqlType<TExpression | null, TInput | null, TOutput | null> => {
    assertColumnType("t.nullable", column);
    return sqlType(column.type, true, column.arrayOf as SqlType<QueryValue, never, unknown> | undefined,
      (value: TInput | null) => value === null ? null : column.encode(value),
      (value: unknown) => value === null ? null : column.decode(value));
  },
});

function scalarType<TExpression extends QueryValue, TValue>(
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

function sqlType<TExpression extends QueryValue, TInput, TOutput>(
  type: ColumnTypeName,
  nullable: boolean,
  arrayOf: SqlType<QueryValue, never, unknown> | undefined,
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
export type AnySqlType = SqlType<QueryValue, never, unknown>;
export type TableSchema = Record<string, AnySqlType>;
type RequireNonEmptySchema<S extends TableSchema> =
  keyof S extends never
    ? { __teta_table_schema_requires_columns__: never }
    : unknown;
type InferQuerySchema<S extends TableSchema> = {
  [K in keyof S]: ExpressionOf<S[K]> extends infer T extends QueryValue
    ? CodecValue<T, InputOf<S[K]>, OutputOf<S[K]>>
    : never;
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
