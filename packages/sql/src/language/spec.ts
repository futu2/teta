/** Catalog of language functions and features covered by Teta's dialect layer. */
export const LANGUAGE_SPEC = {
  math: [
    "+",
    "-",
    "*",
    "/",
    "MOD",
    "ABS",
    "CEIL",
    "FLOOR",
    "SQRT",
    "ROUND",
    "POWER",
    "GREATEST",
    "LEAST",
  ],
  string: [
    "CONCAT",
    "UPPER",
    "LOWER",
    "TRIM",
    "SUBSTRING",
    "POSITION",
    "OVERLAY",
    "CHAR_LENGTH",
    "CHARACTER_LENGTH",
    "OCTET_LENGTH",
    "BIT_LENGTH",
    "REPLACE",
    "REVERSE",
    "LEFT",
    "RIGHT",
    "LPAD",
    "RPAD",
    "REGEXP_LIKE",
    "REGEXP_REPLACE",
    "REGEXP_EXTRACT",
  ],
  logical: [
    "=",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "AND",
    "OR",
    "NOT",
    "LIKE",
    "IN",
  ],
  dateTime: [
    "CURRENT_DATE",
    "CURRENT_TIMESTAMP",
    "EXTRACT",
    "DATE_TRUNC",
    "DATE_ADD",
    "DATE_DIFF",
    "DATE_PARSE",
    "DATE_FORMAT",
    "TO_UNIXTIME",
    "FROM_UNIXTIME",
  ],
  conversionAndNull: [
    "CAST",
    "TRY_CAST",
    "COALESCE",
    "NULLIF",
    "IS NULL",
    "IS NOT NULL",
  ],
  array: [
    "ARRAY_LENGTH",
    "ARRAY_CONTAINS",
    "ARRAY_POSITION",
    "ARRAY_SLICE",
    "ARRAY_JOIN",
    "ARRAY_APPEND",
    "ARRAY_PREPEND",
    "ARRAY_CONCAT",
    "ARRAY_DISTINCT",
  ],
  windowAndAgg: [
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "ARRAY_AGG",
    "RANK",
    "DENSE_RANK",
    "ROW_NUMBER",
    "LAG",
    "LEAD",
    "PERCENT_RANK",
    "NTILE",
  ],
  queryFeatures: ["LATERAL_JOIN", "RECURSIVE_CTE"],
} as const;

/** Category key from `LANGUAGE_SPEC`. */
export type LanguageCategory = keyof typeof LANGUAGE_SPEC;

/** Arity constraints for one portable scalar operation. */
export type BuiltinFunctionArity = Readonly<{
  min: number;
  max: number | null;
}>;

/**
 * Portable scalar operations and their canonical EDSL arities.
 *
 * `max: null` permits additional arguments. Operations with optional SQL
 * arguments record the forms emitted by Teta's portable helpers.
 */
export const BUILTIN_FUNCTION_ARITIES = {
  MOD: { min: 2, max: 2 },
  ABS: { min: 1, max: 1 },
  CEIL: { min: 1, max: 1 },
  FLOOR: { min: 1, max: 1 },
  SQRT: { min: 1, max: 1 },
  ROUND: { min: 1, max: 2 },
  POWER: { min: 2, max: 2 },
  GREATEST: { min: 2, max: null },
  LEAST: { min: 2, max: null },
  CONCAT: { min: 2, max: null },
  UPPER: { min: 1, max: 1 },
  LOWER: { min: 1, max: 1 },
  TRIM: { min: 1, max: 1 },
  SUBSTRING: { min: 2, max: 3 },
  POSITION: { min: 2, max: 2 },
  OVERLAY: { min: 3, max: 4 },
  CHAR_LENGTH: { min: 1, max: 1 },
  CHARACTER_LENGTH: { min: 1, max: 1 },
  OCTET_LENGTH: { min: 1, max: 1 },
  BIT_LENGTH: { min: 1, max: 1 },
  REPLACE: { min: 3, max: 3 },
  REVERSE: { min: 1, max: 1 },
  LEFT: { min: 2, max: 2 },
  RIGHT: { min: 2, max: 2 },
  LPAD: { min: 3, max: 3 },
  RPAD: { min: 3, max: 3 },
  REGEXP_LIKE: { min: 2, max: 2 },
  REGEXP_REPLACE: { min: 3, max: 4 },
  REGEXP_EXTRACT: { min: 2, max: 3 },
  CURRENT_DATE: { min: 0, max: 0 },
  CURRENT_TIMESTAMP: { min: 0, max: 0 },
  DATE_TRUNC: { min: 2, max: 2 },
  DATE_ADD: { min: 3, max: 3 },
  DATE_DIFF: { min: 3, max: 3 },
  DATE_PARSE: { min: 2, max: 2 },
  DATE_FORMAT: { min: 2, max: 2 },
  TO_UNIXTIME: { min: 1, max: 1 },
  FROM_UNIXTIME: { min: 1, max: 1 },
  COALESCE: { min: 2, max: null },
  NULLIF: { min: 2, max: 2 },
  ARRAY_LENGTH: { min: 1, max: 1 },
  ARRAY_CONTAINS: { min: 2, max: 2 },
  ARRAY_POSITION: { min: 2, max: 2 },
  ARRAY_SLICE: { min: 2, max: 3 },
  ARRAY_JOIN: { min: 2, max: 2 },
  ARRAY_APPEND: { min: 2, max: 2 },
  ARRAY_PREPEND: { min: 2, max: 2 },
  ARRAY_CONCAT: { min: 2, max: null },
  ARRAY_DISTINCT: { min: 1, max: 1 },
} as const satisfies Record<string, BuiltinFunctionArity>;

/** Canonical scalar operation represented by a portable `builtin` expression. */
export type BuiltinFunctionOperation = keyof typeof BUILTIN_FUNCTION_ARITIES;

/** Scalar operations emitted by the portable EDSL as typed `builtin` nodes. */
export const BUILTIN_FUNCTION_OPERATIONS = Object.freeze(
  Object.keys(BUILTIN_FUNCTION_ARITIES)
) as readonly BuiltinFunctionOperation[];

const BUILTIN_FUNCTION_OPERATION_SET = new Set<string>(BUILTIN_FUNCTION_OPERATIONS);

/** Return true when a name belongs to Teta's portable scalar-function catalog. */
export function isBuiltinFunctionOperation(value: string): value is BuiltinFunctionOperation {
  return BUILTIN_FUNCTION_OPERATION_SET.has(value);
}

/** Return whether an argument count satisfies one portable operation's contract. */
export function isBuiltinFunctionArityValid(
  operation: BuiltinFunctionOperation,
  argumentCount: number
): boolean {
  const arity = BUILTIN_FUNCTION_ARITIES[operation];
  return argumentCount >= arity.min && (arity.max === null || argumentCount <= arity.max);
}

/** Format one operation's accepted argument count for diagnostics. */
export function formatBuiltinFunctionArity(operation: BuiltinFunctionOperation): string {
  const { min, max } = BUILTIN_FUNCTION_ARITIES[operation];
  if (max === null) return `at least ${formatArgumentCount(min)}`;
  if (min === max) return `exactly ${formatArgumentCount(min)}`;
  return `between ${min} and ${max} arguments`;
}

function formatArgumentCount(value: number): string {
  return `${value} argument${value === 1 ? "" : "s"}`;
}

/** Return the language support catalog. */
export function getLanguageSpec(): typeof LANGUAGE_SPEC {
  return LANGUAGE_SPEC;
}
