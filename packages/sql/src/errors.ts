/** Classifies whether an error came from user input or an internal invariant. */
export type TetaErrorKind = "user" | "internal";

/** Stable error code used by Teta packages. */
export type TetaErrorCode =
  | "GROUP_OUTSIDE_AGGREGATE"
  | "GROUP_INSIDE_AGGREGATE_FUNCTION"
  | "LEGACY_SELECTION_ARRAY"
  | "INVALID_JOIN_TYPE"
  | "UNION_COLUMN_COUNT_MISMATCH"
  | "UNION_COLUMN_NAME_MISMATCH"
  | "JOIN_OVERLAPPING_COLUMNS"
  | "JOIN_MERGE_CONFLICT"
  | "JOIN_MERGE_UNKNOWN_COLUMN"
  | "INVALID_TABLE_SOURCE"
  | "QUERY_SQL_TARGET_MISSING_SCOPE"
  | "LOOP_NESTED_CTES"
  | "LOOP_COLUMN_MISMATCH"
  | "QUERY_HELPER_INVALID_ARGUMENTS"
  | "QUERY_HELPER_INVALID_SELECTOR"
  | "DEFERRED_INPUT_INVALID"
  | "TABLE_SCHEMA_EMPTY"
  | "TABLE_SCHEMA_INVALID"
  | "VALUES_EMPTY"
  | "VALUES_COLUMN_MISMATCH"
  | "VALUES_NO_COLUMNS"
  | "VALUES_UNDEFINED"
  | "INVALID_PARAM_VALUE"
  | "INVALID_PARAM_NAME"
  | "INVALID_FUNCTION_NAME"
  | "INVALID_WINDOW_FUNCTION_NAME"
  | "INVALID_LITERAL_VALUE"
  | "UNSUPPORTED_DIALECT_FUNCTION"
  | "UNSUPPORTED_RECURSIVE_CTE"
  | "INVALID_BUILTIN_DIALECT_NAME"
  | "INVALID_RENDERER_OPTIONS"
  | "CLIPBOARD_TOOL_UNAVAILABLE"
  | "INTERNAL_DEV_RENDER_FAILED"
  | (string & {});

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
