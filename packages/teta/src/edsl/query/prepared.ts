import { collectQueryParameterNames } from "@teta/sql";
import type { SqlOptions } from "../sql/types.ts";
import { param, type Expr } from "../expr.ts";
import { userError } from "../errors.ts";
import { createStringRecord, setStringRecordValue } from "../record.ts";
import { getQueryState, type Query } from "./core.ts";
import { lowerLogicalCtes, lowerLogicalStages } from "./logical.ts";
import {
  isColumnType,
  type AnySqlType,
  type ExpressionOf,
  type InputOf,
  type SqlType,
} from "./schema.ts";
import type { QueryColumns } from "./types.ts";
import { isPlainObject, isQuery } from "./value.ts";

const PREPARED_QUERY_BRAND: unique symbol = Symbol("teta.prepared_query");

export type ParameterSchema = Readonly<Record<string, AnySqlType>>;

export type ParameterRefs<TSchema extends ParameterSchema> = Readonly<{
  [K in keyof TSchema]: Expr<ExpressionOf<TSchema[K]>>;
}>;

export type ParameterBindings<TSchema extends ParameterSchema> = Readonly<{
  [K in keyof TSchema]: InputOf<TSchema[K]>;
}>;

export type PreparedSqlOptions<TSchema extends ParameterSchema> =
  Omit<SqlOptions, "params"> & Readonly<{ params: ParameterBindings<TSchema> }>;

export type PreparedQuery<
  TColumns extends QueryColumns,
  TSchema extends ParameterSchema,
> = Readonly<{
  kind: "prepared_query";
  query: Query<TColumns>;
  parameters: TSchema;
  readonly [PREPARED_QUERY_BRAND]: true;
}>;

export function prepare<
  const TSchema extends ParameterSchema,
  TColumns extends QueryColumns,
>(
  schema: TSchema,
  build: (parameters: ParameterRefs<TSchema>) => Query<TColumns>
): PreparedQuery<TColumns, TSchema> {
  assertParameterSchema(schema);
  if (typeof build !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "prepare() expects a query callback");
  }

  const schemaSnapshot = freezeParameterSchema(schema);
  const refs = createStringRecord<Expr<unknown>>();
  for (const [name, type] of Object.entries(schemaSnapshot)) {
    setStringRecordValue(refs, name, param(name, type));
  }
  const query = build(Object.freeze(refs) as ParameterRefs<TSchema>);
  if (!isQuery(query)) {
    userError("QUERY_HELPER_INVALID_SELECTOR", "prepare() callback must return a query");
  }

  assertPreparedParameterUsage(query, Object.keys(schemaSnapshot));
  const prepared = {
    kind: "prepared_query" as const,
    query,
    parameters: schemaSnapshot,
  } as Omit<PreparedQuery<TColumns, TSchema>, typeof PREPARED_QUERY_BRAND> & {
    [PREPARED_QUERY_BRAND]?: true;
  };
  Object.defineProperty(prepared, PREPARED_QUERY_BRAND, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  });
  return Object.freeze(prepared) as PreparedQuery<TColumns, TSchema>;
}

export function isPreparedQuery(value: unknown): value is PreparedQuery<QueryColumns, ParameterSchema> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    kind?: unknown;
    query?: unknown;
    parameters?: unknown;
    [PREPARED_QUERY_BRAND]?: unknown;
  };
  return candidate.kind === "prepared_query"
    && candidate[PREPARED_QUERY_BRAND] === true
    && isQuery(candidate.query)
    && isParameterSchema(candidate.parameters);
}

export function encodePreparedOptions<TSchema extends ParameterSchema>(
  prepared: PreparedQuery<QueryColumns, TSchema>,
  options: PreparedSqlOptions<TSchema>
): SqlOptions {
  if (!options || !isPlainObject(options.params)) {
    userError("INVALID_PARAM_VALUE", "Prepared queries require a named params object");
  }
  const expected = Object.keys(prepared.parameters);
  const actual = Object.keys(options.params);
  if (
    expected.length !== actual.length
    || expected.some((name) => !Object.hasOwn(options.params, name))
  ) {
    userError("INVALID_PARAM_VALUE", `Prepared query params must be exactly: ${expected.join(", ")}`);
  }

  const encoded = createStringRecord<unknown>();
  for (const name of expected) {
    const type = prepared.parameters[name]!;
    const encode = type.encode as (value: unknown) => unknown;
    setStringRecordValue(encoded, name, encode(options.params[name]));
  }
  return { ...options, params: encoded };
}

function assertPreparedParameterUsage(
  query: Query<QueryColumns>,
  declaredNames: readonly string[]
): void {
  const state = getQueryState(query);
  const used = collectQueryParameterNames({
    version: 1,
    source: state.source,
    stages: lowerLogicalStages(state.stages, {
      scopeId: state.sourceScopeId,
      columnNames: state.sourceColumnNames,
      columnIdentifiers: state.sourceColumnIdentifiers,
    }),
    scopeId: state.sourceScopeId,
    columnNames: state.columnNames,
    columnIdentifiers: state.columnIdentifiers,
    withs: lowerLogicalCtes(state.withs),
  });
  const declared = new Set(declaredNames);
  const undeclared = [...used].filter((name) => !declared.has(name));
  const unused = declaredNames.filter((name) => !used.has(name));
  if (undeclared.length || unused.length) {
    userError(
      "INVALID_PARAM_VALUE",
      `Prepared query parameter mismatch; undeclared: ${undeclared.join(", ") || "none"}; unused: ${unused.join(", ") || "none"}`
    );
  }
}

function assertParameterSchema(value: unknown): asserts value is ParameterSchema {
  if (!isParameterSchema(value)) {
    userError("TABLE_SCHEMA_INVALID", "prepare() parameter schema must contain SQL type descriptors");
  }
}

function isParameterSchema(value: unknown): value is ParameterSchema {
  return isPlainObject(value) && Object.values(value).every(isColumnType);
}

function freezeParameterSchema<TSchema extends ParameterSchema>(schema: TSchema): TSchema {
  const snapshot = createStringRecord<AnySqlType>();
  for (const [name, type] of Object.entries(schema)) {
    setStringRecordValue(snapshot, name, type);
  }
  return Object.freeze(snapshot) as TSchema;
}
