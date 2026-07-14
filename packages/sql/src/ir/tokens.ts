import { userError } from "../errors.ts";

const IDENTIFIER_SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const POSITIONAL_PARAMETER = /^[1-9][0-9]*$/;
const CAST_TYPE = /^[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*(?:\s*\(\s*[0-9]+(?:\s*,\s*[0-9]+)?\s*\))?(?:\s*\[\s*\])*$/;

/** Return true when a value is a bare SQL identifier segment. */
export function isSqlIdentifierSegment(value: string): boolean {
  return typeof value === "string" && IDENTIFIER_SEGMENT.test(value);
}

/** Return true when a value is a safely rendered SQL function name. */
export function isSqlFunctionName(value: string): boolean {
  return typeof value === "string" && value.split(".").every(isSqlIdentifierSegment);
}

/** Return true when a value can identify a named or positional parameter. */
export function isSqlParameterName(value: string): boolean {
  return typeof value === "string"
    && (IDENTIFIER_SEGMENT.test(value) || POSITIONAL_PARAMETER.test(value));
}

/** Return true when a parameter name is valid for a named placeholder. */
export function isSqlNamedParameter(value: string): boolean {
  return typeof value === "string" && IDENTIFIER_SEGMENT.test(value);
}

/** Return true when a parameter name is valid for a positional placeholder. */
export function isSqlPositionalParameter(value: string): boolean {
  return typeof value === "string" && POSITIONAL_PARAMETER.test(value);
}

/** Return true when a value is a supported safe SQL cast target declaration. */
export function isSqlCastTarget(value: string): boolean {
  return typeof value === "string" && CAST_TYPE.test(value);
}

/** Assert that a public function name cannot inject SQL syntax. */
export function assertSqlFunctionName(name: string, label = "function name"): void {
  if (!isSqlFunctionName(name)) {
    userError("INVALID_FUNCTION_NAME", `${label} must be a dot-separated SQL identifier`);
  }
}

/** Assert that a public parameter name cannot inject SQL syntax. */
export function assertSqlParameterName(name: string): void {
  if (!isSqlParameterName(name)) {
    userError("INVALID_PARAM_NAME", "param name must be an identifier or a positive positional index");
  }
}

/** Assert that a named rendering placeholder has a safe identifier. */
export function assertSqlNamedParameter(name: string): void {
  if (!isSqlNamedParameter(name)) {
    userError("INVALID_PARAM_NAME", "named parameters must use an identifier name");
  }
}

/** Assert that a positional rendering placeholder has a safe one-based index. */
export function assertSqlPositionalParameter(name: string): void {
  if (!isSqlPositionalParameter(name)) {
    userError("INVALID_PARAM_NAME", "positional parameters must use a positive numeric name");
  }
}

/** Assert that a cast target is a type declaration rather than arbitrary SQL text. */
export function assertSqlCastTarget(target: string): void {
  if (!isSqlCastTarget(target)) {
    userError(
      "INVALID_FUNCTION_NAME",
      "cast target must be a SQL type name with optional numeric precision or array suffix"
    );
  }
}

/** Assert that an EXTRACT field is an identifier token rather than arbitrary SQL text. */
export function assertSqlExtractField(field: string): void {
  if (!isSqlIdentifierSegment(field)) {
    userError("INVALID_FUNCTION_NAME", "extract field must be a SQL identifier");
  }
}
