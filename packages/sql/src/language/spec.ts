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

/** Canonical scalar operation represented by a portable `builtin` expression. */
export type BuiltinFunctionOperation =
  | Exclude<(typeof LANGUAGE_SPEC)["math"][number], "+" | "-" | "*" | "/">
  | (typeof LANGUAGE_SPEC)["string"][number]
  | Exclude<(typeof LANGUAGE_SPEC)["dateTime"][number], "EXTRACT">
  | Extract<(typeof LANGUAGE_SPEC)["conversionAndNull"][number], "COALESCE" | "NULLIF">
  | (typeof LANGUAGE_SPEC)["array"][number];

/** Immutable arity catalog for all portable scalar operations. */
export type BuiltinFunctionArityCatalog = Readonly<
  Record<BuiltinFunctionOperation, BuiltinFunctionArity>
>;

/**
 * Type-level classification used by expression builders.
 *
 * The renderer only needs arity, but a frontend also needs to know whether an
 * operation is null-propagating and what broad SQL domain it produces. Keeping
 * that information in the language catalog prevents each frontend from
 * inventing a second, subtly different list of operation names.
 */
export type BuiltinFunctionResultKind =
  | "same"
  | "number"
  | "integer"
  | "float"
  | "string"
  | "boolean"
  | "date"
  | "timestamp"
  | "array"
  | "unknown";

/** Broad SQL argument domains understood by typed EDSL frontends. */
export type BuiltinFunctionInputDomain =
  | "unknown"
  | "numeric"
  | "integer"
  | "string"
  | "boolean"
  | "dateLike"
  | "array"
  | "integer?"
  | "string?";

export type BuiltinFunctionNullability =
  | "propagate"
  | "coalesce"
  | "never"
  | "always"
  | "unknown";

export type BuiltinFunctionSpec = Readonly<{
  arity: BuiltinFunctionArity;
  inputs: readonly BuiltinFunctionInputDomain[];
  variadic: BuiltinFunctionInputDomain | null;
  result: BuiltinFunctionResultKind;
  nullability: BuiltinFunctionNullability;
}>;

export type BuiltinFunctionSpecCatalog = Readonly<
  Record<BuiltinFunctionOperation, BuiltinFunctionSpec>
>;

/**
 * Canonical scalar-operation catalog shared by validation, rendering, and
 * typed frontends. Arity is derived from the argument domains, so adding an
 * operation requires one semantic declaration instead of synchronized maps.
 */
export const BUILTIN_FUNCTION_SPECS = Object.freeze({
  MOD: builtin(["numeric", "numeric"], null, "same", "propagate"),
  ABS: builtin(["numeric"], null, "same", "propagate"),
  CEIL: builtin(["numeric"], null, "integer", "propagate"),
  FLOOR: builtin(["numeric"], null, "integer", "propagate"),
  SQRT: builtin(["numeric"], null, "float", "propagate"),
  ROUND: builtin(["numeric", "integer?"], null, "same", "propagate"),
  POWER: builtin(["numeric", "numeric"], null, "float", "propagate"),
  GREATEST: builtin(["numeric", "numeric"], "numeric", "same", "propagate"),
  LEAST: builtin(["numeric", "numeric"], "numeric", "same", "propagate"),
  CONCAT: builtin(["unknown", "unknown"], "unknown", "string", "propagate"),
  UPPER: builtin(["string"], null, "string", "propagate"),
  LOWER: builtin(["string"], null, "string", "propagate"),
  TRIM: builtin(["string"], null, "string", "propagate"),
  SUBSTRING: builtin(["string", "integer", "integer?"], null, "string", "propagate"),
  POSITION: builtin(["string", "string"], null, "integer", "propagate"),
  OVERLAY: builtin(["string", "string", "integer", "integer?"], null, "string", "propagate"),
  CHAR_LENGTH: builtin(["string"], null, "integer", "propagate"),
  CHARACTER_LENGTH: builtin(["string"], null, "integer", "propagate"),
  OCTET_LENGTH: builtin(["string"], null, "integer", "propagate"),
  BIT_LENGTH: builtin(["string"], null, "integer", "propagate"),
  REPLACE: builtin(["string", "string", "string"], null, "string", "propagate"),
  REVERSE: builtin(["string"], null, "string", "propagate"),
  LEFT: builtin(["string", "integer"], null, "string", "propagate"),
  RIGHT: builtin(["string", "integer"], null, "string", "propagate"),
  LPAD: builtin(["string", "integer", "string"], null, "string", "propagate"),
  RPAD: builtin(["string", "integer", "string"], null, "string", "propagate"),
  REGEXP_LIKE: builtin(["string", "string"], null, "boolean", "propagate"),
  REGEXP_REPLACE: builtin(["string", "string", "string", "string?"], null, "string", "propagate"),
  REGEXP_EXTRACT: builtin(["string", "string", "integer?"], null, "string", "propagate"),
  CURRENT_DATE: builtin([], null, "date", "never"),
  CURRENT_TIMESTAMP: builtin([], null, "timestamp", "never"),
  DATE_TRUNC: builtin(["string", "dateLike"], null, "timestamp", "propagate"),
  DATE_ADD: builtin(["string", "integer", "dateLike"], null, "timestamp", "propagate"),
  DATE_DIFF: builtin(["string", "dateLike", "dateLike"], null, "integer", "propagate"),
  DATE_PARSE: builtin(["string", "string"], null, "timestamp", "propagate"),
  DATE_FORMAT: builtin(["dateLike", "string"], null, "string", "propagate"),
  TO_UNIXTIME: builtin(["dateLike"], null, "float", "propagate"),
  FROM_UNIXTIME: builtin(["numeric"], null, "timestamp", "propagate"),
  COALESCE: builtin(["unknown", "unknown"], "unknown", "same", "coalesce"),
  NULLIF: builtin(["unknown", "unknown"], null, "same", "always"),
  ARRAY_LENGTH: builtin(["array"], null, "integer", "propagate"),
  ARRAY_CONTAINS: builtin(["array", "unknown"], null, "boolean", "propagate"),
  ARRAY_POSITION: builtin(["array", "unknown"], null, "integer", "propagate"),
  ARRAY_SLICE: builtin(["array", "integer", "integer?"], null, "array", "propagate"),
  ARRAY_JOIN: builtin(["array", "string"], null, "string", "propagate"),
  ARRAY_APPEND: builtin(["array", "unknown"], null, "array", "propagate"),
  ARRAY_PREPEND: builtin(["array", "unknown"], null, "array", "propagate"),
  ARRAY_CONCAT: builtin(["array", "array"], "array", "array", "propagate"),
  ARRAY_DISTINCT: builtin(["array"], null, "array", "propagate"),
} satisfies BuiltinFunctionSpecCatalog);

/** Scalar operations emitted by the portable EDSL as typed `builtin` nodes. */
export const BUILTIN_FUNCTION_OPERATIONS = Object.freeze(
  Object.keys(BUILTIN_FUNCTION_SPECS)
) as readonly BuiltinFunctionOperation[];

/** Arity view derived from the canonical scalar-operation catalog. */
export const BUILTIN_FUNCTION_ARITIES: BuiltinFunctionArityCatalog = Object.freeze(
  Object.fromEntries(BUILTIN_FUNCTION_OPERATIONS.map((operation) => [
    operation,
    BUILTIN_FUNCTION_SPECS[operation].arity,
  ])) as Record<BuiltinFunctionOperation, BuiltinFunctionArity>
);

function builtin<
  const TInputs extends readonly BuiltinFunctionInputDomain[],
  const TVariadic extends BuiltinFunctionInputDomain | null,
  const TResult extends BuiltinFunctionResultKind,
  const TNullability extends BuiltinFunctionNullability,
>(
  inputs: TInputs,
  variadic: TVariadic,
  result: TResult,
  nullability: TNullability
): Readonly<{
  arity: BuiltinFunctionArity;
  inputs: TInputs;
  variadic: TVariadic;
  result: TResult;
  nullability: TNullability;
}> {
  const firstOptional = inputs.findIndex((input) => input.endsWith("?"));
  if (firstOptional >= 0 && inputs.slice(firstOptional).some((input) => !input.endsWith("?"))) {
    throw new Error("Optional builtin argument domains must follow required domains");
  }
  return Object.freeze({
    arity: Object.freeze({
      min: firstOptional < 0 ? inputs.length : firstOptional,
      max: variadic === null ? inputs.length : null,
    }),
    inputs: Object.freeze([...inputs]) as unknown as TInputs,
    variadic,
    result,
    nullability,
  });
}

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
  const arity = BUILTIN_FUNCTION_SPECS[operation].arity;
  return argumentCount >= arity.min && (arity.max === null || argumentCount <= arity.max);
}

/** Format one operation's accepted argument count for diagnostics. */
export function formatBuiltinFunctionArity(operation: BuiltinFunctionOperation): string {
  const { min, max } = BUILTIN_FUNCTION_SPECS[operation].arity;
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
