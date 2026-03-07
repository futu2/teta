export const GROUP_OUTSIDE_AGGREGATE_ERROR =
  "group() is only valid inside aggregate()";

export const GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR =
  "group() cannot be used inside aggregate functions";

export const UNSUPPORTED_CROSS_JOIN_ERROR = "Unsupported join type: cross";

export const LOOP_COLUMN_MISMATCH_ERROR =
  "union requires both queries to have matching column names";

export const NON_CANONICAL_POSTGRES_DIALECT_ERROR =
  "Invalid built-in dialect 'PostgreSQL'. Use canonical lowercase 'postgresql'.";

export function missingQueryExportError(path: string): string {
  return `Export 'query' not found in ${path}`;
}
