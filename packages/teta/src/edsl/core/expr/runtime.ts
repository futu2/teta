import {
  OUTER_TABLE_ALIAS,
  type AggFunc,
  type BigIntLiteral,
  type BinaryOp,
  type DateLiteral,
  type ExprNode,
  type OrderItem,
  type ScopeId,
  type TimestampLiteral,
  type Value,
} from "../types.ts";
import type {
  NormalizeExpressionLiteral,
  SqlBigInt,
  SqlBoolean,
  SqlDate,
  SqlNumber,
  SqlString,
  SqlTimestamp,
  SqlUuid,
} from "../../sql/types.ts";
import {
  formatBuiltinFunctionArity,
  isBuiltinFunctionArityValid,
  isBuiltinFunctionOperation,
  assertSqlFunctionName,
  assertSqlParameterName,
  isSqlDateLiteral,
  isSqlTimestampLiteral,
} from "@teta/sql";
import {
  containsGroup,
  dedupeExprs,
  shouldAlias,
  unwrapGroupExpr,
} from "./node/ops.ts";
import { userError } from "../../errors.ts";
import { resolveFreezeFlag } from "../../runtime_config.ts";

type SqlLiteralInput = Value | bigint;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true
  ? false
  : unknown extends T
    ? true
    : false;

type LiteralInput<T> = IsAny<T> extends true
  ? SqlLiteralInput
  : IsUnknown<T> extends true
    ? SqlLiteralInput
  : T extends number
    ? number
  : T extends bigint
    ? number | bigint
  : T extends string
    ? string
  : T extends boolean
    ? boolean
  : T extends null
    ? null
  : never;
export type ExprInput<T> = Expr<T, ExprPhase> | LiteralInput<T>;
export type ExprInputValue<TInput> =
  TInput extends Expr<infer TValue, ExprPhase> ? TValue
  : TInput;
export type ExprInputTuple<T extends readonly unknown[]> = {
  [K in keyof T]: ExprInput<T[K]>;
};
export type NonNull<T> = Exclude<T, null>;
export type PropagateNull<TInput, TResult> = null extends TInput ? TResult | null : TResult;
export type WindowSpecInput = {
  partitionBy?: Expr<unknown> | Expr<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp | null;
type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableSqlNumber = SqlNumber | null;
type NullableString = string | null;

const BINARY_OPS = new Set<string>([
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "AND",
  "OR",
  "+",
  "-",
  "*",
  "/",
  "||",
  "LIKE",
  "IS",
  "IS NOT",
  "IN",
  "NOT IN",
  "BETWEEN",
  "IS DISTINCT FROM",
]);

const AGG_FUNCS = new Set<string>(["COUNT", "SUM", "AVG", "MIN", "MAX", "ARRAY_AGG"]);
const SHOULD_FREEZE_EXPR_VALUES = resolveFreezeFlag("TETA_FREEZE_EXPR_VALUES");
const EXPR_BRAND: unique symbol = Symbol("teta.expr");
const COLUMN_BRAND: unique symbol = Symbol("teta.column");
const WINDOW_BUILDER_BRAND: unique symbol = Symbol("teta.window_builder");

export type ExprPhase = "row" | "group" | "aggregate";

export type Expr<T, TPhase extends ExprPhase = "row"> = Readonly<{
  kind: "expr";
  node: ExprNode<T>;
  readonly __phase?: TPhase;
  readonly [EXPR_BRAND]: true;
}>;

export type ColumnTableRef = ScopeId | typeof OUTER_TABLE_ALIAS | null;

export type Column<T, Name extends string> = Expr<T, "row"> & Readonly<{
  table: ColumnTableRef;
  name: Name;
  readonly [COLUMN_BRAND]: true;
}>;

export type WindowExpr<T> = Readonly<{
  kind: "window_builder";
  name: string;
  args: readonly ExprNode<unknown>[];
  readonly __valueType?: T;
  readonly [WINDOW_BUILDER_BRAND]: true;
}>;

export type WindowBuilder<T> = WindowExpr<T>;

export function exprOf<T>(node: ExprNode<T>): Expr<T> {
  return defineHiddenBrand(
    { kind: "expr" as const, node: freezeExprNode(node) },
    EXPR_BRAND
  ) as Expr<T>;
}

export function exprOfPhase<T, TPhase extends ExprPhase>(
  node: ExprNode<T>,
  _phase: TPhase
): Expr<T, TPhase> {
  return exprOf(node) as Expr<T, TPhase>;
}

export function withExprPhase<T, TPhase extends ExprPhase>(
  expr: Expr<T, ExprPhase>,
  _phase: TPhase
): Expr<T, TPhase> {
  return expr as Expr<T, TPhase>;
}

export function columnOf<T, Name extends string>(
  table: ColumnTableRef,
  name: Name
): Column<T, Name> {
  const node = freezeExprNode({ kind: "column", table, name } as ExprNode<T>);
  const expr = {
    kind: "expr" as const,
    node,
    table,
    name,
  };
  defineHiddenBrandProperty(expr, EXPR_BRAND);
  defineHiddenBrandProperty(expr, COLUMN_BRAND);
  return freezeIfEnabled(expr) as Column<T, Name>;
}

export function windowBuilderOf<T>(
  name: string,
  args: readonly ExprNode<unknown>[]
): WindowBuilder<T> {
  assertSqlFunctionName(name, "window function name");
  return defineHiddenBrand({
    kind: "window_builder" as const,
    name,
    args: freezeIfEnabled(args.map((arg) => freezeExprNode(arg))),
  }, WINDOW_BUILDER_BRAND) as WindowBuilder<T>;
}

export function isExpr(value: unknown): value is Expr<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; node?: unknown; [EXPR_BRAND]?: unknown };
  return candidate.kind === "expr" && candidate[EXPR_BRAND] === true && isExprNode(candidate.node);
}

export function isColumn(value: unknown): value is Column<unknown, string> {
  if (!isExpr(value)) return false;
  const candidate = value as {
    kind?: unknown;
    node?: unknown;
    table?: unknown;
    name?: unknown;
    [COLUMN_BRAND]?: unknown;
  };
  if (
    candidate.kind !== "expr" ||
    candidate[COLUMN_BRAND] !== true ||
    !isColumnNode(candidate.node as { kind?: unknown })
  ) {
    return false;
  }
  const node = candidate.node as { table: unknown; name: unknown };
  return candidate.table === node.table && candidate.name === node.name;
}

export function isExprNode(value: unknown): value is ExprNode<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown };
  switch (candidate.kind) {
    case "column":
      return isColumnNode(candidate);
    case "literal":
      return isLiteralNode(candidate);
    case "param":
      return isParamNode(candidate);
    case "binary":
      return isBinaryNode(candidate);
    case "unary":
      return isUnaryNode(candidate);
    case "agg":
      return isAggNode(candidate);
    case "group":
      return isGroupNode(candidate);
    case "builtin":
      return isBuiltinFuncNode(candidate);
    case "func":
      return isFuncNode(candidate);
    case "list":
    case "array":
      return isExprNodeArray((candidate as { items?: unknown }).items);
    case "extract":
      return isExtractNode(candidate);
    case "cast":
      return isCastNode(candidate);
    case "window":
      return isWindowNode(candidate);
    case "case":
      return isCaseNode(candidate);
    default:
      return false;
  }
}

function freezeExprNode<T>(node: ExprNode<T>): ExprNode<T> {
  if (!isExprNode(node)) {
    userError("INVALID_LITERAL_VALUE", `Unsupported literal value: ${String(node)}`);
  }
  if (!SHOULD_FREEZE_EXPR_VALUES) return node;
  return deepFreeze(node);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object") return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

function freezeIfEnabled<T extends object>(value: T): T {
  return SHOULD_FREEZE_EXPR_VALUES ? Object.freeze(value) : value;
}

function defineHiddenBrand<T extends object, TBrand extends symbol>(
  value: T,
  brand: TBrand
): T & { readonly [K in TBrand]: true } {
  defineHiddenBrandProperty(value, brand);
  return freezeIfEnabled(value) as T & { readonly [K in TBrand]: true };
}

function defineHiddenBrandProperty<TBrand extends symbol>(
  value: object,
  brand: TBrand
): void {
  Object.defineProperty(value, brand, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  });
}

function isColumnNode(value: { kind?: unknown }): boolean {
  const candidate = value as { table?: unknown; name?: unknown };
  return (
    (typeof candidate.table === "string" || candidate.table === null) &&
    typeof candidate.name === "string"
  );
}

function isLiteralNode(value: { kind?: unknown }): boolean {
  return isLiteralValue((value as { value?: unknown }).value);
}

function isLiteralValue(value: unknown): value is Value {
  const type = typeof value;
  return value === null
    || type === "string"
    || (type === "number" && Number.isFinite(value))
    || type === "boolean"
    || isTemporalLiteral(value);
}

function isParamNode(value: { kind?: unknown }): boolean {
  const candidate = value as { name?: unknown };
  return typeof candidate.name === "string" && candidate.name.trim().length > 0;
}

function isBinaryNode(value: { kind?: unknown }): boolean {
  const candidate = value as { op?: unknown; left?: unknown; right?: unknown };
  return (
    typeof candidate.op === "string" &&
    BINARY_OPS.has(candidate.op) &&
    isExprNode(candidate.left) &&
    isExprNode(candidate.right)
  );
}

function isUnaryNode(value: { kind?: unknown }): boolean {
  const candidate = value as { op?: unknown; expr?: unknown };
  return candidate.op === "NOT" && isExprNode(candidate.expr);
}

function isAggNode(value: { kind?: unknown }): boolean {
  const candidate = value as { name?: unknown; arg?: unknown; distinct?: unknown };
  return (
    typeof candidate.name === "string" &&
    (AGG_FUNCS.has(candidate.name) || candidate.name.length > 0) &&
    isExprNode(candidate.arg) &&
    typeof candidate.distinct === "boolean"
  );
}

function isGroupNode(value: { kind?: unknown }): boolean {
  return isExprNode((value as { expr?: unknown }).expr);
}

function isBuiltinFuncNode(value: { kind?: unknown }): boolean {
  const candidate = value as { op?: unknown; args?: unknown };
  return typeof candidate.op === "string"
    && isBuiltinFunctionOperation(candidate.op)
    && isExprNodeArray(candidate.args)
    && isBuiltinFunctionArityValid(candidate.op, candidate.args.length);
}

function isFuncNode(value: { kind?: unknown }): boolean {
  const candidate = value as { name?: unknown; args?: unknown };
  return typeof candidate.name === "string" && isExprNodeArray(candidate.args);
}

function isExtractNode(value: { kind?: unknown }): boolean {
  const candidate = value as { field?: unknown; source?: unknown };
  return typeof candidate.field === "string" && isExprNode(candidate.source);
}

function isCastNode(value: { kind?: unknown }): boolean {
  const candidate = value as { expr?: unknown; target?: unknown };
  return typeof candidate.target === "string" && isExprNode(candidate.expr);
}

function isWindowNode(value: { kind?: unknown }): boolean {
  const candidate = value as {
    name?: unknown;
    args?: unknown;
    partitionBy?: unknown;
    orderBy?: unknown;
  };
  return (
    typeof candidate.name === "string" &&
    isExprNodeArray(candidate.args) &&
    isNullableExprNodeArray(candidate.partitionBy) &&
    isNullableOrderItems(candidate.orderBy)
  );
}

function isCaseNode(value: { kind?: unknown }): boolean {
  const candidate = value as { whens?: unknown; elseExpr?: unknown };
  return (
    Array.isArray(candidate.whens) &&
    candidate.whens.every(isCaseWhenNode) &&
    (candidate.elseExpr === null || isExprNode(candidate.elseExpr))
  );
}

function isCaseWhenNode(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { when?: unknown; then?: unknown };
  return isExprNode(candidate.when) && isExprNode(candidate.then);
}

function isExprNodeArray(value: unknown): value is ExprNode<unknown>[] {
  return Array.isArray(value) && value.every(isExprNode);
}

function isNullableExprNodeArray(value: unknown): boolean {
  return value === null || isExprNodeArray(value);
}

function isNullableOrderItems(value: unknown): boolean {
  return value === null || (Array.isArray(value) && value.every(isOrderItem));
}

function isOrderItem(value: unknown): value is OrderItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { expr?: unknown; direction?: unknown };
  return (
    isExprNode(candidate.expr) &&
    (candidate.direction === "ASC" || candidate.direction === "DESC")
  );
}

type KnownStringKeyOf<T extends Record<string, unknown>> = Extract<{
  [K in keyof T]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof T], string>;

export type ColumnRefs<T extends Record<string, unknown>> = {
  [K in KnownStringKeyOf<T>]: Column<T[K], K>;
};
export type Exprs<T extends Record<string, unknown>> = {
  [K in KnownStringKeyOf<T>]: Expr<T[K]>;
};

export function lit<T extends SqlNumber | SqlString | SqlBoolean | SqlDate | SqlTimestamp | SqlUuid>(
  value: T
): Expr<T>;
export function lit(value: string): Expr<SqlString>;
export function lit(value: number): Expr<SqlNumber>;
export function lit(value: bigint): Expr<SqlBigInt>;
export function lit(value: boolean): Expr<SqlBoolean>;
export function lit(value: null): Expr<null>;
export function lit(value: DateLiteral): Expr<SqlDate>;
export function lit(value: TimestampLiteral): Expr<SqlTimestamp>;
export function lit<T extends Value>(value: T): Expr<NormalizeExpressionLiteral<T>>;
export function lit(value: Value | bigint): Expr<NormalizeExpressionLiteral<Value>> {
  const literal = typeof value === "bigint"
    ? { kind: "bigint_literal", value: value.toString() } as BigIntLiteral
    : value;
  if (!isLiteralValue(literal)) {
    userError("INVALID_LITERAL_VALUE", `Unsupported literal value: ${String(value)}`);
  }
  return exprOf<NormalizeExpressionLiteral<Value>>({
    kind: "literal",
    value: literal,
  });
}

export function param<T = unknown>(name: string): Expr<T>;
export function param(name: string): Expr<unknown> {
  assertSqlParameterName(name);
  return exprOf<unknown>({ kind: "param", name });
}

export function array<T = unknown>(...values: ExprInput<T>[]): Expr<T[]> {
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
): Expr<T> {
  assertSqlFunctionName(name);
  return funcExpr(name, args.map((arg) => toExprNode(arg)));
}

export function windowFn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): WindowBuilder<T> {
  assertSqlFunctionName(name, "window function name");
  return windowBuilderOf<T>(name, args.map((arg) => toExprNode(arg)));
}

export function wrapExpr<T>(value: ExprInput<T>): Expr<T> {
  if (isExpr(value)) return value as Expr<T>;
  return exprOf<T>(toExprNode(value));
}

export function aggregateExpr<T, TArg extends ExprInput<unknown>>(
  name: AggFunc,
  arg: TArg
): Expr<T> {
  return exprOf<T>({
    kind: "agg",
    name,
    arg: toExprNode(arg as ExprInput<unknown>),
    distinct: false,
  });
}

export function windowExpr<T>(name: string, ...args: ExprInput<unknown>[]): WindowBuilder<T> {
  assertSqlFunctionName(name, "window function name");
  return windowBuilderOf<T>(name, args.map((arg) => toExprNode(arg)));
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<T> {
  if (isExpr(value)) return value.node as ExprNode<T>;
  if (value === undefined) {
    userError("INVALID_LITERAL_VALUE", "Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "bigint") {
    return {
      kind: "literal",
      value: { kind: "bigint_literal", value: value.toString() } as BigIntLiteral,
    } as ExprNode<T>;
  }
  if (isLiteralValue(value)) {
    return { kind: "literal", value } as ExprNode<T>;
  }
  userError("INVALID_LITERAL_VALUE", `Unsupported literal value: ${String(value)}`);
}

function isTemporalLiteral(value: unknown): value is DateLiteral | TimestampLiteral | BigIntLiteral {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  if (typeof candidate.value !== "string" || candidate.value.length === 0) return false;
  if (candidate.kind === "date_literal") return isSqlDateLiteral(candidate.value);
  if (candidate.kind === "timestamp_literal") return isSqlTimestampLiteral(candidate.value);
  return candidate.kind === "bigint_literal" && /^-?(0|[1-9][0-9]*)$/.test(candidate.value);
}

export { containsGroup, unwrapGroupExpr, dedupeExprs, shouldAlias };

export function toExprNodeList(
  input?: Expr<unknown> | Expr<unknown>[]
): ExprNode<unknown>[] | null {
  if (!input) return null;
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => toExprNode(item));
}

export function toOrderItems(input?: OrderItem | OrderItem[]): OrderItem[] | null {
  if (!input) return null;
  return Array.isArray(input) ? input : [input];
}

export function over<T>(window: WindowBuilder<T>, spec: WindowSpecInput = {}): Expr<T> {
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
): Expr<unknown> {
  return exprOf<unknown>({ kind: "binary", op, left, right });
}

export function funcExpr<T>(name: string, args: ExprNode<unknown>[]): Expr<T> {
  assertSqlFunctionName(name);
  const operation = name.toUpperCase();
  if (isBuiltinFunctionOperation(operation)) {
    if (!isBuiltinFunctionArityValid(operation, args.length)) {
      userError(
        "INVALID_FUNCTION_NAME",
        `${operation} expects ${formatBuiltinFunctionArity(operation)}`
      );
    }
    return exprOf<T>({ kind: "builtin", op: operation, args });
  }
  return exprOf<T>({ kind: "func", name, args });
}
