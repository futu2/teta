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

export const LEGACY_JOIN_MERGE_OPTION_ERROR =
  "join() no longer accepts { merge }. Pass merge as the next argument before options.";

export const JOIN_OVERLAPPING_COLUMNS_ERROR =
  "join() requires an explicit merge strategy for overlapping columns: id";

export const JOIN_MERGE_CONFLICT_ERROR =
  "join merge helper produced duplicate output column: user_id";

export function missingQueryExportError(path: string): string {
  return `Export 'query' not found in ${path}`;
}

export function duplicateProjectionNameError(name: string): string {
  return `Duplicate projected column name: ${name}`;
}
