export type TetaErrorKind = "user" | "internal";

export type TetaErrorCode =
  | "GROUP_OUTSIDE_AGGREGATE"
  | "GROUP_INSIDE_AGGREGATE_FUNCTION"
  | "LEGACY_SELECTION_ARRAY"
  | "INVALID_JOIN_TYPE"
  | "UNION_COLUMN_COUNT_MISMATCH"
  | "UNION_COLUMN_NAME_MISMATCH"
  | "INVALID_TABLE_SOURCE"
  | "LOOP_NESTED_CTES"
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

export class TetaUserError extends TetaError {
  constructor(code: TetaErrorCode, message: string) {
    super("user", code, message);
  }
}

export class TetaInternalError extends TetaError {
  constructor(code: TetaErrorCode, message: string) {
    super("internal", code, message);
  }
}

export function isTetaError(value: unknown): value is TetaError {
  return value instanceof TetaError;
}

export function userError(code: TetaErrorCode, message: string): never {
  throw new TetaUserError(code, message);
}

export function internalError(code: TetaErrorCode, message: string): never {
  throw new TetaInternalError(code, message);
}
