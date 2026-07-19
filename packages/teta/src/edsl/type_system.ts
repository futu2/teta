import type {
  SqlBigInt,
  SqlBoolean,
  SqlBytes,
  SqlDate,
  SqlDecimal,
  SqlFloat,
  SqlInt,
  SqlJson,
  SqlNumber,
  SqlString,
  SqlTimestamp,
  SqlUnknown,
  SqlUuid,
  NormalizeExpressionLiteral,
} from "./sql/types.ts";
import type { ExprNode } from "./core/types.ts";
import type {
  BuiltinFunctionNullability,
  BuiltinFunctionOperation,
  BuiltinFunctionResultKind,
  BuiltinFunctionSpec,
} from "@teta/sql";

declare const CODEC_VALUE: unique symbol;

/** Static phases an expression may inhabit while a query is being built. */
export type ExprPhase = "row" | "group" | "aggregate";

/** A value that can legally appear in a query row. */
export type SqlValue =
  | SqlInt
  | SqlFloat
  | SqlBigInt
  | SqlDecimal
  | SqlString
  | SqlBoolean
  | SqlDate
  | SqlTimestamp
  | SqlUuid
  | SqlBytes
  | SqlJson
  | SqlUnknown
  | null
  | readonly SqlValue[];

/** Add SQL nullability without widening the underlying SQL value domain. */
export type Nullable<T> = T | null;

/** Remove SQL nullability from a value type. */
export type NonNullableSql<T> = Exclude<T, null>;

/** True when a SQL value can evaluate to NULL. */
export type IsNullable<T> = null extends T ? true : false;

/** Result of a null-propagating scalar operation. */
export type PropagateSqlNull<TInput, TResult> =
  null extends TInput ? TResult | null : TResult;

/**
 * Codec metadata carried by a projected expression type.
 *
 * The properties are optional and phantom: runtime expression nodes remain
 * unchanged, but a table column can retain the input and decoded output types
 * supplied by its schema descriptor through maps and projections.
 */
export type CodecValue<
  TExpression extends SqlValue,
  TInput,
  TOutput,
> = TExpression extends null
  ? null
  : TExpression & {
      readonly [CODEC_VALUE]: {
        readonly expression: TExpression;
        readonly input: TInput;
        readonly output: TOutput;
      };
    };

/** Remove descriptor metadata from an expression value when its SQL type is needed. */
export type SqlExpressionValue<T> = T extends null
  ? null
  : T extends readonly (infer TItem)[]
    ? readonly SqlExpressionValue<TItem>[]
    : T extends { readonly [CODEC_VALUE]: { readonly expression: infer TExpression } }
      ? SqlExpressionValue<TExpression>
      : T;

/** SQL expression type carried by a descriptor. */
export type ExpressionValue<T> = T extends {
  readonly __teta_expression?: infer TExpression;
}
  ? TExpression
  : T;

/** Input type carried by a schema/parameter descriptor. */
export type InputValue<T> = T extends {
  readonly __teta_input?: infer TInput;
}
  ? TInput
  : never;

/** Decoded output type carried by a projected expression. */
export type OutputValue<T> = T extends null
  ? null
  : T extends { readonly [CODEC_VALUE]: { readonly output: infer TOutput } }
    ? TOutput
    : DriverValue<T>;

/** Host/driver value corresponding to a SQL expression value. */
export type DriverValue<T> = T extends null
  ? null
  : T extends { readonly [CODEC_VALUE]: { readonly output: infer TOutput } }
    ? TOutput
    : T extends SqlInt | SqlFloat | SqlDecimal
      ? number
      : T extends SqlBigInt
        ? bigint
        : T extends SqlBoolean
          ? boolean
          : T extends SqlDate | SqlTimestamp | SqlUuid | SqlString
            ? string
            : T extends SqlBytes
              ? Uint8Array
              : T extends readonly (infer TItem)[]
                ? readonly DriverValue<TItem>[]
                : T extends SqlJson<infer TJson>
                  ? TJson
                  : T extends SqlUnknown
                    ? unknown
                    : T;

/** Decode a query row shape from its expression/schema values. */
export type DecodedRow<TColumns extends Record<string, unknown>> = {
  readonly [K in keyof TColumns]: OutputValue<TColumns[K]>;
};

/** Input bindings corresponding to a descriptor map. */
export type InputBindings<TSchema extends Record<string, unknown>> = {
  readonly [K in keyof TSchema]: InputValue<TSchema[K]>;
};

/** Narrow numeric SQL values used by arithmetic operators. */
export type NumericValue = Exclude<SqlNumber, null>;

/** Unknown SQL output is explicit and must be narrowed before host use. */
export type UnknownValue = SqlUnknown;

/** Domains accepted by a checked scalar operation. */
export type OperationInputDomain =
  | "unknown"
  | "numeric"
  | "integer"
  | "string"
  | "boolean"
  | "dateLike"
  | "array"
  | "integer?"
  | "string?";

/** Host literals and SQL values accepted for one operation domain. */
export type OperationInputValue<TDomain extends OperationInputDomain> =
  TDomain extends "numeric" ? SqlNumber | number | bigint | null
  : TDomain extends "integer" | "integer?" ? SqlInt | number | null
  : TDomain extends "string" | "string?" ? SqlString | string | null
  : TDomain extends "boolean" ? SqlBoolean | boolean | null
  : TDomain extends "dateLike" ? SqlDate | SqlTimestamp | string | null
  : TDomain extends "array" ? readonly SqlValue[] | null
  : SqlValue | number | bigint | string | boolean;

/** A typed operation descriptor used by both checked expression builders and custom frontends. */
export type OperationSpec<
  TName extends BuiltinFunctionOperation = BuiltinFunctionOperation,
  TInputs extends readonly OperationInputDomain[] = readonly OperationInputDomain[],
  TOutput extends BuiltinFunctionResultKind = BuiltinFunctionResultKind,
  TNullability extends BuiltinFunctionNullability = BuiltinFunctionNullability,
  TPhase extends ExprPhase = "row",
> = Readonly<{
  name: TName;
  inputs: TInputs;
  output: TOutput;
  nullability: TNullability;
  phase: TPhase;
  /** Runtime arity and dialect metadata from the backend language catalog. */
  language: BuiltinFunctionSpec;
}>;

type KnownOperationCatalog = {
  MOD: OperationSpec<"MOD", readonly ["numeric", "numeric"], "same", "propagate">;
  ABS: OperationSpec<"ABS", readonly ["numeric"], "same", "propagate">;
  CEIL: OperationSpec<"CEIL", readonly ["numeric"], "integer", "propagate">;
  FLOOR: OperationSpec<"FLOOR", readonly ["numeric"], "integer", "propagate">;
  SQRT: OperationSpec<"SQRT", readonly ["numeric"], "float", "propagate">;
  ROUND: OperationSpec<"ROUND", readonly ["numeric", "integer?"], "same", "propagate">;
  POWER: OperationSpec<"POWER", readonly ["numeric", "numeric"], "float", "propagate">;
  GREATEST: OperationSpec<"GREATEST", readonly ["numeric", ..."numeric"[]], "same", "propagate">;
  LEAST: OperationSpec<"LEAST", readonly ["numeric", ..."numeric"[]], "same", "propagate">;
  CONCAT: OperationSpec<"CONCAT", readonly ["unknown", ..."unknown"[]], "string", "propagate">;
  UPPER: OperationSpec<"UPPER", readonly ["string"], "string", "propagate">;
  LOWER: OperationSpec<"LOWER", readonly ["string"], "string", "propagate">;
  TRIM: OperationSpec<"TRIM", readonly ["string"], "string", "propagate">;
  SUBSTRING: OperationSpec<"SUBSTRING", readonly ["string", "integer", "integer?"], "string", "propagate">;
  POSITION: OperationSpec<"POSITION", readonly ["string", "string"], "integer", "propagate">;
  OVERLAY: OperationSpec<"OVERLAY", readonly ["string", "string", "integer", "integer?"], "string", "propagate">;
  CHAR_LENGTH: OperationSpec<"CHAR_LENGTH", readonly ["string"], "integer", "propagate">;
  CHARACTER_LENGTH: OperationSpec<"CHARACTER_LENGTH", readonly ["string"], "integer", "propagate">;
  OCTET_LENGTH: OperationSpec<"OCTET_LENGTH", readonly ["string"], "integer", "propagate">;
  BIT_LENGTH: OperationSpec<"BIT_LENGTH", readonly ["string"], "integer", "propagate">;
  REPLACE: OperationSpec<"REPLACE", readonly ["string", "string", "string"], "string", "propagate">;
  REVERSE: OperationSpec<"REVERSE", readonly ["string"], "string", "propagate">;
  LEFT: OperationSpec<"LEFT", readonly ["string", "integer"], "string", "propagate">;
  RIGHT: OperationSpec<"RIGHT", readonly ["string", "integer"], "string", "propagate">;
  LPAD: OperationSpec<"LPAD", readonly ["string", "integer", "string"], "string", "propagate">;
  RPAD: OperationSpec<"RPAD", readonly ["string", "integer", "string"], "string", "propagate">;
  REGEXP_LIKE: OperationSpec<"REGEXP_LIKE", readonly ["string", "string"], "boolean", "propagate">;
  REGEXP_REPLACE: OperationSpec<"REGEXP_REPLACE", readonly ["string", "string", "string", "string?"], "string", "propagate">;
  REGEXP_EXTRACT: OperationSpec<"REGEXP_EXTRACT", readonly ["string", "string", "integer?"], "string", "propagate">;
  CURRENT_DATE: OperationSpec<"CURRENT_DATE", readonly [], "date", "never">;
  CURRENT_TIMESTAMP: OperationSpec<"CURRENT_TIMESTAMP", readonly [], "timestamp", "never">;
  DATE_TRUNC: OperationSpec<"DATE_TRUNC", readonly ["string", "dateLike"], "timestamp", "propagate">;
  DATE_ADD: OperationSpec<"DATE_ADD", readonly ["string", "integer", "dateLike"], "timestamp", "propagate">;
  DATE_DIFF: OperationSpec<"DATE_DIFF", readonly ["string", "dateLike", "dateLike"], "integer", "propagate">;
  DATE_PARSE: OperationSpec<"DATE_PARSE", readonly ["string", "string"], "timestamp", "propagate">;
  DATE_FORMAT: OperationSpec<"DATE_FORMAT", readonly ["dateLike", "string"], "string", "propagate">;
  TO_UNIXTIME: OperationSpec<"TO_UNIXTIME", readonly ["dateLike"], "float", "propagate">;
  FROM_UNIXTIME: OperationSpec<"FROM_UNIXTIME", readonly ["numeric"], "timestamp", "propagate">;
  COALESCE: OperationSpec<"COALESCE", readonly ["unknown", ..."unknown"[]], "same", "never">;
  NULLIF: OperationSpec<"NULLIF", readonly ["unknown", "unknown"], "same", "always">;
  ARRAY_LENGTH: OperationSpec<"ARRAY_LENGTH", readonly ["array"], "integer", "propagate">;
  ARRAY_CONTAINS: OperationSpec<"ARRAY_CONTAINS", readonly ["array", "unknown"], "boolean", "propagate">;
  ARRAY_POSITION: OperationSpec<"ARRAY_POSITION", readonly ["array", "unknown"], "integer", "propagate">;
  ARRAY_SLICE: OperationSpec<"ARRAY_SLICE", readonly ["array", "integer", "integer?"], "array", "propagate">;
  ARRAY_JOIN: OperationSpec<"ARRAY_JOIN", readonly ["array", "string"], "string", "propagate">;
  ARRAY_APPEND: OperationSpec<"ARRAY_APPEND", readonly ["array", "unknown"], "array", "propagate">;
  ARRAY_PREPEND: OperationSpec<"ARRAY_PREPEND", readonly ["array", "unknown"], "array", "propagate">;
  ARRAY_CONCAT: OperationSpec<"ARRAY_CONCAT", readonly ["array", ..."array"[]], "array", "propagate">;
  ARRAY_DISTINCT: OperationSpec<"ARRAY_DISTINCT", readonly ["array"], "array", "propagate">;
};

type UnknownOperationCatalog = {
  [TName in Exclude<BuiltinFunctionOperation, keyof KnownOperationCatalog>]: OperationSpec<
    TName,
    readonly ["unknown", ..."unknown"[]],
    "unknown",
    "unknown"
  >;
};

/** Canonical operation catalog for the public EDSL. */
export type SqlOperationCatalog = KnownOperationCatalog & UnknownOperationCatalog;
export type OperationName = keyof SqlOperationCatalog;
export type OperationSpecOf<TName extends OperationName> = SqlOperationCatalog[TName];
export type OperationInputs<TName extends OperationName> = OperationSpecOf<TName>["inputs"];

type OperationValue<TValue> = TValue extends { readonly node: ExprNode<infer TExpression> }
  ? SqlExpressionValue<TExpression>
  : NormalizeExpressionLiteral<TValue>;

type OperationOutputValue<
  TName extends OperationName,
  TKind extends BuiltinFunctionResultKind,
  TArgs extends readonly unknown[],
> =
  TKind extends "same"
    ? TName extends "COALESCE"
      ? Exclude<OperationValue<TArgs[number]>, null>
      : TArgs extends readonly [infer TFirst, ...unknown[]]
        ? Exclude<OperationValue<TFirst>, null>
        : Exclude<OperationValue<TArgs[number]>, null>
    : TKind extends "number"
      ? SqlNumber
      : TKind extends "integer"
        ? SqlInt
        : TKind extends "float"
          ? SqlFloat
          : TKind extends "string"
            ? SqlString
            : TKind extends "boolean"
              ? SqlBoolean
              : TKind extends "date"
                ? SqlDate
                : TKind extends "timestamp"
                  ? SqlTimestamp
                  : TKind extends "array"
                    ? readonly SqlValue[]
                    : SqlUnknown;

/** Result type inferred from one catalog operation and its expression arguments. */
export type OperationResult<
  TName extends OperationName,
  TArgs extends readonly unknown[],
> = OperationSpecOf<TName>["nullability"] extends "always"
  ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs> | null
  : OperationSpecOf<TName>["nullability"] extends "never"
    ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs>
    : null extends OperationValue<TArgs[number]>
      ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs> | null
      : OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs>;
