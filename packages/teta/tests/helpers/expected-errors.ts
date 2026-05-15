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

export const LEGACY_LEFT_JOIN_FIXED_MERGE_ERROR =
  "leftJoin() no longer accepts a merge or projection argument. Use leftJoinMap(...) for custom output or leftJoinMerge(...) for merge helpers.";

export const MAP_CURRIED_ONLY_ERROR =
  "map() is curried-only. Use pipe(query, map(selector)).";

export const EXTEND_CURRIED_ONLY_ERROR =
  "extend() is curried-only. Use pipe(query, extend(selector)).";

export const FILTER_CURRIED_ONLY_ERROR =
  "filter() is curried-only. Use pipe(query, filter(predicate)).";

export const FOLD_CURRIED_ONLY_ERROR =
  "fold() is curried-only. Use pipe(query, fold(selector)).";

export const SORT_CURRIED_ONLY_ERROR =
  "sort() is curried-only. Use pipe(query, sort(selector)).";

export const TAKE_CURRIED_ONLY_ERROR =
  "take() is curried-only. Use pipe(query, take(count)).";

export const JOIN_CURRIED_ONLY_ERROR =
  "join() is curried-only. Use pipe(query, join(right, on, merge?, options?)).";

export const INNER_JOIN_CURRIED_ONLY_ERROR =
  "innerJoin() is curried-only. Use pipe(query, innerJoin(right, on, options?)).";

export const LEFT_JOIN_CURRIED_ONLY_ERROR =
  "leftJoin() is curried-only. Use pipe(query, leftJoin(right, on, options?)).";

export const RIGHT_JOIN_CURRIED_ONLY_ERROR =
  "rightJoin() is curried-only. Use pipe(query, rightJoin(right, on, options?)).";

export const FULL_JOIN_CURRIED_ONLY_ERROR =
  "fullJoin() is curried-only. Use pipe(query, fullJoin(right, on, options?)).";

export const SELECT_DUPLICATE_COLUMN_ERROR =
  "Duplicate selected column name: id";

export const SELECT_ALIAS_EMPTY_ERROR =
  "alias name cannot be empty";

export const SELECT_INVALID_SELECTION_ERROR =
  "select() items must be expressions";

export const JOIN_OVERLAPPING_COLUMNS_ERROR =
  "join() requires an explicit merge strategy for overlapping columns: id";

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
