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
  BuiltinFunctionInputDomain,
  BuiltinFunctionNullability,
  BuiltinFunctionOperation,
  BuiltinFunctionResultKind,
  BuiltinFunctionSpec,
} from "@teta/sql";
import { BUILTIN_FUNCTION_SPECS } from "@teta/sql";

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
export type OperationInputDomain = BuiltinFunctionInputDomain;

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

type CatalogOperationInputs<TName extends BuiltinFunctionOperation> =
  (typeof BUILTIN_FUNCTION_SPECS)[TName] extends infer TSpec extends BuiltinFunctionSpec
    ? readonly [
        ...TSpec["inputs"],
        ...(TSpec["variadic"] extends BuiltinFunctionInputDomain ? TSpec["variadic"][] : []),
      ]
    : never;

/** Canonical operation catalog for the public EDSL, derived from @teta/sql. */
export type SqlOperationCatalog = {
  [TName in BuiltinFunctionOperation]: OperationSpec<
    TName,
    CatalogOperationInputs<TName>,
    (typeof BUILTIN_FUNCTION_SPECS)[TName]["result"],
    (typeof BUILTIN_FUNCTION_SPECS)[TName]["nullability"]
  >;
};
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

type CoalesceResult<TArgs extends readonly unknown[]> =
  | Exclude<OperationValue<TArgs[number]>, null>
  | ([Exclude<OperationValue<TArgs[number]>, null>] extends [never] ? null : never);

/** Result type inferred from one catalog operation and its expression arguments. */
export type OperationResult<
  TName extends OperationName,
  TArgs extends readonly unknown[],
> = OperationSpecOf<TName>["nullability"] extends "coalesce"
  ? CoalesceResult<TArgs>
  : OperationSpecOf<TName>["nullability"] extends "always"
  ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs> | null
  : OperationSpecOf<TName>["nullability"] extends "never"
    ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs>
    : null extends OperationValue<TArgs[number]>
      ? OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs> | null
      : OperationOutputValue<TName, OperationSpecOf<TName>["output"], TArgs>;
