export const GROUP_OUTSIDE_AGGREGATE_ERROR =
  "group() is only valid inside fold()";

export const GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR =
  "group() cannot be used inside fold functions";

export const UNSUPPORTED_CROSS_JOIN_ERROR = "Unsupported join type: cross";

export const LOOP_COLUMN_MISMATCH_ERROR =
  "union requires both queries to have matching column names";

export const NON_CANONICAL_POSTGRES_DIALECT_ERROR =
  "Invalid built-in dialect 'PostgreSQL'. Use canonical lowercase 'postgresql'.";

export const LEGACY_SELECTION_ARRAY_ERROR =
  "map() and fold() now expect an object shape";

export const VALUES_EMPTY_ERROR =
  "values() requires at least one row";

export const VALUES_COLUMN_MISMATCH_ERROR =
  "values() row 2 must have exactly the same columns as row 1";

export const VALUES_NO_COLUMNS_ERROR =
  "values() rows must define at least one column";

export const VALUES_ROW_INVALID_ERROR =
  "values() row 1 must be an object";

export const VALUES_UNDEFINED_ERROR =
  "values() row 1 column 'id' cannot be undefined";

export const TABLE_SCHEMA_EMPTY_ERROR =
  "table() schema must define at least one column";

export const TABLE_SCHEMA_INVALID_ERROR =
  "table() schema column 'payload' must be a column type";

export const JOIN_OVERLAPPING_COLUMNS_ERROR =
  "Join helpers require an explicit merge strategy for overlapping columns: id";

export const JOIN_MERGE_CONFLICT_ERROR =
  "join merge helper still overlaps after renaming: user_id";

export const DEFERRED_CURRENT_COLUMN_UNKNOWN_ERROR =
  "Unknown current row column 'missing'. Available columns: id, name";

export const DEFERRED_LEFT_COLUMN_UNKNOWN_ERROR =
  "Unknown join left column 'missing'. Available columns: id, name";

export const DEFERRED_RIGHT_COLUMN_UNKNOWN_ERROR =
  "Unknown join right column 'missing'. Available columns: order_id, user_id, total";

export const DEFERRED_LEFT_SCOPE_ERROR =
  "Join left column 'id' cannot be resolved in this query helper";

export function missingQueryExportError(path: string): string {
  return `Export 'query' not found in ${path}`;
}

export function duplicateProjectionNameError(name: string): string {
  return `Duplicate projected column name: ${name}`;
}
