/** Classifies whether an error came from user input or an internal invariant. */
export type TetaErrorKind = "user" | "internal";

/**
 * Stable error codes emitted by Teta packages.
 *
 * This catalog is part of the cross-language contract. Add a code here before
 * using it so TypeScript and generated bindings share the same closed set.
 */
export const TETA_ERROR_CODES = [
  "CLIPBOARD_TOOL_UNAVAILABLE",
  "DEFERRED_COLUMN_UNKNOWN",
  "DEFERRED_INPUT_INVALID",
  "GROUP_INSIDE_AGGREGATE_FUNCTION",
  "GROUP_OUTSIDE_AGGREGATE",
  "INTERNAL_BUILD_PIPELINE_FAILED",
  "INTERNAL_CTE_NAME_CONFLICT",
  "INTERNAL_DEV_RENDER_FAILED",
  "INTERNAL_EMPTY_PREDICATE_MERGE",
  "INTERNAL_JOIN_ALIAS_REQUIRED",
  "INTERNAL_LOOP_COMPILE_FAILED",
  "INTERNAL_MISSING_FUSED_SCOPE_MAPPING",
  "INTERNAL_MISSING_SQL_SCOPE_BINDING",
  "INTERNAL_PARSER_SELECT_EXPECTED",
  "INTERNAL_PROJECTION_ITEM_OUTPUT_IDENTIFIER_MISSING",
  "INTERNAL_STAGE_COMPILE_FAILED",
  "INTERNAL_STAGE_PROJECTION_ITEM_OUTPUT_NAME_MISSING",
  "INTERNAL_UNEXPECTED_EXPRESSION_NODE",
  "INTERNAL_UNEXPECTED_LITERAL_VALUE",
  "INTERNAL_UNEXPECTED_VALUE",
  "INTERNAL_UNION_STAGE_ROUTING",
  "INTERNAL_UNKNOWN_COLUMN_REF",
  "INTERNAL_UNNAMED_PROJECTION_ITEM",
  "INTERNAL_UNNEST_ALIAS_REQUIRED",
  "INTERNAL_UNNEST_IDENTIFIER_MISSING",
  "INVALID_BUILTIN_DIALECT_NAME",
  "INVALID_FUNCTION_NAME",
  "INVALID_JOIN_TYPE",
  "INVALID_LITERAL_VALUE",
  "INVALID_PARAM_NAME",
  "INVALID_PARAM_VALUE",
  "INVALID_QUERY_IR",
  "INVALID_RENDERER_OPTIONS",
  "INVALID_TABLE_SOURCE",
  "INVALID_WINDOW_FUNCTION_NAME",
  "JOIN_MERGE_CONFLICT",
  "JOIN_MERGE_UNKNOWN_COLUMN",
  "JOIN_OVERLAPPING_COLUMNS",
  "LEGACY_SELECTION_ARRAY",
  "LOOP_COLUMN_MISMATCH",
  "LOOP_NESTED_CTES",
  "LOOP_UNSUPPORTED_STAGE",
  "QUERY_FILTER_INVALID_OPERAND",
  "QUERY_HELPER_INVALID_ARGUMENTS",
  "QUERY_HELPER_INVALID_SELECTOR",
  "QUERY_SQL_TARGET_MISSING_SCOPE",
  "TABLE_SCHEMA_EMPTY",
  "TABLE_SCHEMA_INVALID",
  "UNION_COLUMN_COUNT_MISMATCH",
  "UNION_COLUMN_NAME_MISMATCH",
  "UNNEST_COLUMN_CONFLICT",
  "UNSUPPORTED_DIALECT_FUNCTION",
  "UNSUPPORTED_RECURSIVE_CTE",
  "UNSUPPORTED_UNNEST",
  "VALUES_COLUMN_MISMATCH",
  "VALUES_EMPTY",
  "VALUES_NO_COLUMNS",
  "VALUES_UNDEFINED",
] as const;

/** Stable error code used by Teta packages. */
export type TetaErrorCode = (typeof TETA_ERROR_CODES)[number];

/** Return whether a value is a known stable Teta error code. */
export function isTetaErrorCode(value: unknown): value is TetaErrorCode {
  return typeof value === "string" && (TETA_ERROR_CODES as readonly string[]).includes(value);
}

/** Base class for user-facing and internal Teta errors. */
export class TetaError extends Error {
  constructor(
    readonly kind: TetaErrorKind,
    readonly code: TetaErrorCode,
    message: string
  ) {
    super(message);
    this.name = kind === "user" ? "TetaUserError" : "TetaInternalError";
  }
}

/** Error raised for invalid user input or unsupported requested behavior. */
export class TetaUserError extends TetaError {
  constructor(code: TetaErrorCode, message: string) {
    super("user", code, message);
  }
}

/** Error raised when a renderer or IR invariant is violated. */
export class TetaInternalError extends TetaError {
  constructor(code: TetaErrorCode, message: string) {
    super("internal", code, message);
  }
}

/** Return true when a value is a Teta error instance. */
export function isTetaError(value: unknown): value is TetaError {
  return value instanceof TetaError;
}

/** Throw a `TetaUserError` with a stable code. */
export function userError(code: TetaErrorCode, message: string): never {
  throw new TetaUserError(code, message);
}

/** Throw a `TetaInternalError` with a stable code. */
export function internalError(code: TetaErrorCode, message: string): never {
  throw new TetaInternalError(code, message);
}
