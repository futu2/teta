import {
  OUTER_TABLE_ALIAS,
  type AggFunc,
  type BinaryOp,
  type DateLiteral,
  type ExprNode,
  type OrderItem,
  type ScopeId,
  type TimestampLiteral,
  type Value,
} from "../types.ts";
import type {
  NormalizeNumericLiteral,
  NormalizeNumericLiteralTuple,
  SqlDate,
  SqlFloat,
  SqlInt,
  SqlNumber,
  SqlTimestamp,
  SqlUuid,
} from "../../sql/types.ts";
import {
  containsGroup,
  dedupeExprs,
  shouldAlias,
  unwrapGroupExpr,
} from "./node/ops.ts";
import { userError } from "../../errors.ts";

type StringLiteralCompatible = string | SqlDate | SqlTimestamp | SqlUuid;

type LiteralInput<T> = T extends number
  ? number
  : T extends bigint
    ? number | bigint
  : T extends StringLiteralCompatible
    ? string
    : T;
export type ExprInput<T> = ExprRef<T> | LiteralInput<T>;
export type ExprInputValue<TInput> = TInput extends ExprRef<infer TValue> ? TValue : TInput;
export type ExprInputTuple<T extends readonly unknown[]> = {
  [K in keyof T]: ExprInput<T[K]>;
};
export type NonNull<T> = Exclude<T, null>;
export type PropagateNull<TInput, TResult> = null extends TInput ? TResult | null : TResult;
export type WindowSpecInput = {
  partitionBy?: ExprRef<unknown> | ExprRef<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp | null;
type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableSqlNumber = SqlNumber | null;
type NullableString = string | null;

export type Expr<T> = Readonly<{
  kind: "expr";
  node: ExprNode<T>;
}>;

export type ColumnTableRef = ScopeId | typeof OUTER_TABLE_ALIAS | null;

export type Column<T, Name extends string> = Readonly<{
  kind: "column";
  node: ExprNode<T>;
  table: ColumnTableRef;
  name: Name;
}>;

export type ExprRef<T> = Expr<T> | Column<T, string>;

export type ColumnRef<T, Name extends string> = Column<T, Name>;

export const ExprRef = function <T>(this: unknown, node: ExprNode<T>): ExprRef<T> {
  return exprOf<T>(node);
} as {
  new <T>(node: ExprNode<T>): ExprRef<T>;
  <T>(node: ExprNode<T>): ExprRef<T>;
};

export type WindowExpr<T> = Readonly<{
  kind: "window_builder";
  name: string;
  args: readonly ExprNode<unknown>[];
  readonly __valueType?: T;
}>;

export type WindowBuilder<T> = WindowExpr<T>;

export function exprOf<T>(node: ExprNode<T>): Expr<T> {
  return Object.freeze({ kind: "expr" as const, node });
}

export function columnOf<T, Name extends string>(
  table: ColumnTableRef,
  name: Name
): Column<T, Name> {
  return Object.freeze({
    kind: "column" as const,
    node: { kind: "column", table, name } as ExprNode<T>,
    table,
    name,
  });
}

export function windowBuilderOf<T>(
  name: string,
  args: readonly ExprNode<unknown>[]
): WindowBuilder<T> {
  return Object.freeze({ kind: "window_builder" as const, name, args: [...args] });
}

export function isExpr(value: unknown): value is ExprRef<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; node?: unknown };
  return (
    (candidate.kind === "expr" || candidate.kind === "column") &&
    isExprNode(candidate.node)
  );
}

export function isColumn(value: unknown): value is Column<unknown, string> {
  if (!isExpr(value)) return false;
  const candidate = value as { kind?: unknown; table?: unknown; name?: unknown };
  return candidate.kind === "column" && typeof candidate.name === "string";
}

function isExprNode(value: unknown): value is ExprNode<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown };
  return typeof candidate.kind === "string";
}

type KnownStringKeyOf<T extends Record<string, unknown>> = Extract<{
  [K in keyof T]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof T], string>;

export type ColumnRefs<T extends Record<string, unknown>> = {
  [K in KnownStringKeyOf<T>]: ColumnRef<T[K], K>;
};
export type ExprRefs<T extends Record<string, unknown>> = {
  [K in KnownStringKeyOf<T>]: ExprRef<T[K]>;
};

export function lit<T extends Value>(value: T): ExprRef<T> {
  return exprOf<T>({ kind: "literal", value });
}

export function param<T>(value: T, name: string | null = null): ExprRef<T> {
  if (value === undefined) {
    userError("INVALID_PARAM_VALUE", "Unsupported parameter value: undefined");
  }
  if (name !== null && !name.trim()) {
    userError("INVALID_PARAM_NAME", "param name cannot be empty");
  }
  return exprOf<T>({ kind: "param", value, name });
}

export function array<T = unknown>(...values: ExprInput<T>[]): ExprRef<T[]> {
  return exprOf<T[]>({
    kind: "array",
    items: values.map((value) => toExprNode(value)),
  });
}

export function fn<
  T = unknown,
  const TArgs extends readonly ExprInput<unknown>[] = readonly ExprInput<unknown>[],
>(
  name: string,
  ...args: TArgs
): ExprRef<T> {
  if (!name.trim()) {
    userError("INVALID_FUNCTION_NAME", "fn requires a function name");
  }
  return funcExpr(name, args.map((arg) => toExprNode(arg)));
}

export function windowFn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): WindowBuilder<T> {
  if (!name.trim()) {
    userError("INVALID_WINDOW_FUNCTION_NAME", "windowFn requires a function name");
  }
  return windowBuilderOf<T>(name, args.map((arg) => toExprNode(arg)));
}

export function wrapExpr<T>(value: ExprInput<T>): ExprRef<T> {
  if (isExpr(value)) return value as ExprRef<T>;
  return exprOf<T>(toExprNode(value));
}

export function aggregateExpr<T, TArg extends ExprInput<unknown>>(
  name: AggFunc,
  arg: TArg
): ExprRef<T> {
  return exprOf<T>({
    kind: "agg",
    name,
    arg: toExprNode(arg as ExprInput<unknown>),
    distinct: false,
  });
}

export function windowExpr<T>(name: string, ...args: ExprInput<unknown>[]): WindowBuilder<T> {
  return windowBuilderOf<T>(name, args.map((arg) => toExprNode(arg)));
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<T> {
  if (isExpr(value)) return value.node as ExprNode<T>;
  if (value === undefined) {
    userError("INVALID_LITERAL_VALUE", "Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "bigint") {
    return { kind: "literal", value: value as Value } as ExprNode<T>;
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value } as ExprNode<T>;
  }
  userError("INVALID_LITERAL_VALUE", `Unsupported literal value: ${String(value)}`);
}

function isTemporalLiteral(value: unknown): value is DateLiteral | TimestampLiteral {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  if (candidate.value !== undefined && typeof candidate.value !== "string") return false;
  return candidate.kind === "date_literal" || candidate.kind === "timestamp_literal";
}

export { containsGroup, unwrapGroupExpr, dedupeExprs, shouldAlias };

export function toExprNodeList(
  input?: ExprRef<unknown> | ExprRef<unknown>[]
): ExprNode<unknown>[] | null {
  if (!input) return null;
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => toExprNode(item));
}

export function toOrderItems(input?: OrderItem | OrderItem[]): OrderItem[] | null {
  if (!input) return null;
  return Array.isArray(input) ? input : [input];
}

export function over<T>(window: WindowBuilder<T>, spec: WindowSpecInput = {}): ExprRef<T> {
  const partitionBy = toExprNodeList(spec.partitionBy);
  const orderBy = toOrderItems(spec.orderBy);
  return exprOf<T>({
    kind: "window",
    name: window.name,
    args: [...window.args],
    partitionBy,
    orderBy,
  });
}

export function binaryExpr(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown> {
  return exprOf<unknown>({ kind: "binary", op, left, right });
}

export function funcExpr<T>(name: string, args: ExprNode<unknown>[]): ExprRef<T> {
  return exprOf<T>({ kind: "func", name, args });
}
