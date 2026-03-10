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
  SqlRenderer,
  SqlResult,
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

export interface ExprRef<T> {
}

export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}
}

export type ColumnTableRef = ScopeId | typeof OUTER_TABLE_ALIAS | null;

export class ColumnRef<T, Name extends string> extends ExprRef<T> {
  readonly table: ColumnTableRef;
  readonly name: Name;

  constructor(table: ColumnTableRef, name: Name) {
    super({ kind: "column", table, name });
    this.table = table;
    this.name = name;
  }
}

export type ColumnRefs<T extends Record<string, unknown>> = {
  [K in keyof T & string]: ColumnRef<T[K], K>;
};
export type ExprRefs<T extends Record<string, unknown>> = {
  [K in keyof T & string]: ExprRef<T[K]>;
};

export function lit<T extends Value>(value: T): ExprRef<T> {
  return new ExprRef<T>({ kind: "literal", value });
}

export function param<T>(value: T, name: string | null = null): ExprRef<T> {
  if (value === undefined) {
    userError("INVALID_PARAM_VALUE", "Unsupported parameter value: undefined");
  }
  if (name !== null && !name.trim()) {
    userError("INVALID_PARAM_NAME", "param name cannot be empty");
  }
  return new ExprRef<T>({ kind: "param", value, name });
}

export function array<T = unknown>(...values: ExprInput<T>[]): ExprRef<T[]> {
  return new ExprRef<T[]>({
    kind: "array",
    items: values.map((value) => toExprNode(value)),
  });
}

export function fn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
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
  return new WindowBuilder<T>(name, args.map((arg) => toExprNode(arg)));
}

export function wrapExpr<T>(value: ExprInput<T>): ExprRef<T> {
  if (value instanceof ExprRef) return value;
  return new ExprRef<T>(toExprNode(value) as ExprNode<T>);
}

export function aggregateExpr<T>(name: AggFunc, arg: ExprInput<unknown>): ExprRef<T> {
  return new ExprRef<T>({
    kind: "agg",
    name,
    arg: toExprNode(arg),
    distinct: false,
  });
}

export function windowExpr<T>(name: string, ...args: ExprInput<unknown>[]): WindowBuilder<T> {
  return new WindowBuilder<T>(name, args.map((arg) => toExprNode(arg)));
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<unknown> {
  if (value instanceof ExprRef) return value.node;
  if (value === undefined) {
    userError("INVALID_LITERAL_VALUE", "Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "bigint") {
    return { kind: "literal", value: value as Value };
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value };
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

export class WindowBuilder<T> {
  declare readonly __valueType?: never & T;

  constructor(readonly name: string, readonly args: ExprNode<unknown>[]) {}
}

export function over<T>(window: WindowBuilder<T>, spec: WindowSpecInput = {}): ExprRef<T> {
  const partitionBy = toExprNodeList(spec.partitionBy);
  const orderBy = toOrderItems(spec.orderBy);
  return new ExprRef<T>({
    kind: "window",
    name: window.name,
    args: window.args,
    partitionBy,
    orderBy,
  });
}

export function binaryExpr(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown> {
  return new ExprRef({ kind: "binary", op, left, right });
}

export function funcExpr<T>(name: string, args: ExprNode<unknown>[]): ExprRef<T> {
  return new ExprRef<T>({ kind: "func", name, args });
}
