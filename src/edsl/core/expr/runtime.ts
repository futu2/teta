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
export type CaseBuilder<T> = {
  when: (condition: ExprInput<boolean>, value: ExprInput<T>) => CaseBuilder<T>;
  else: (value: ExprInput<T>) => ExprRef<T>;
  end: () => ExprRef<T | null>;
};

export type WindowSpecInput = {
  partitionBy?: ExprRef<unknown> | ExprRef<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

type ComparableInput = SqlNumber | SqlDate | SqlTimestamp | null;
type NullableDateLike = SqlDate | SqlTimestamp | string | null;
type NullableSqlNumber = SqlNumber | null;
type NullableString = string | null;

export interface ExprRef<T> {
  eq(value: ExprInput<T>): ExprRef<boolean>;
  ne(value: ExprInput<T>): ExprRef<boolean>;
  gt<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
  gte<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
  lt<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
  lte<TValue extends ComparableInput>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<boolean>;
  like(this: ExprRef<string | null>, value: ExprInput<string>): ExprRef<boolean>;
  ["in"](values: readonly ExprInput<T>[]): ExprRef<boolean>;
  and(this: ExprRef<boolean | null>, value: ExprInput<boolean | null>): ExprRef<boolean>;
  or(this: ExprRef<boolean | null>, value: ExprInput<boolean | null>): ExprRef<boolean>;
  not(this: ExprRef<boolean | null>): ExprRef<boolean>;
  isNull(): ExprRef<boolean>;
  isNotNull(): ExprRef<boolean>;
  asc(): OrderItem;
  desc(): OrderItem;

  add<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
  sub<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
  mul<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
  div<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
  mod<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, value: ExprInput<TValue>): ExprRef<TValue>;
  ceil<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  floor<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  abs<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<TValue>;
  sqrt<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
  pow<TValue extends NullableSqlNumber>(
    this: ExprRef<TValue>,
    exponent: ExprInput<TValue>
  ): ExprRef<PropagateNull<TValue, SqlFloat>>;
  greatest<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
  least<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, ...values: ExprInput<TValue>[]): ExprRef<TValue>;
  cast<TTarget = unknown>(target: string): ExprRef<TTarget>;
  toInt<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  toFloat<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
  toDate<TValue extends SqlTimestamp | null>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlDate>>;
  round<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, scale?: ExprInput<SqlInt>): ExprRef<TValue>;

  extract<TValue>(this: ExprRef<TValue>, field: string): ExprRef<PropagateNull<TValue, SqlFloat>>;
  dateTrunc<TValue extends NullableDateLike>(this: ExprRef<TValue>, unit: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
  dateAdd<TValue extends NullableDateLike>(
    this: ExprRef<TValue>,
    unit: ExprInput<string>,
    amount: ExprInput<SqlInt>
  ): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
  dateDiff<TValue extends NullableDateLike>(
    this: ExprRef<TValue>,
    unit: ExprInput<string>,
    other: ExprInput<NullableDateLike>
  ): ExprRef<PropagateNull<TValue | NullableDateLike, SqlInt>>;
  dateFormat<TValue extends NullableDateLike>(this: ExprRef<TValue>, format: ExprInput<string>): ExprRef<PropagateNull<TValue, string>>;
  dateParse<TValue extends string | null>(this: ExprRef<TValue>, format: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
  toUnixTime<TValue extends NullableDateLike>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
  fromUnixTime<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
  year<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  month<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  day<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  hour<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  minute<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  second<TValue>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;

  group(this: ExprRef<T>): ExprRef<T>;
  count(this: ExprRef<unknown>): ExprRef<SqlInt>;
  sum<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<TValue>;
  avg<TValue extends NullableSqlNumber>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlFloat>>;
  min(this: ExprRef<T>): ExprRef<T>;
  max(this: ExprRef<T>): ExprRef<T>;
  rank(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
  denseRank(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
  rowNumber(this: ExprRef<unknown>): WindowBuilder<SqlInt>;
  lag(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T>;
  lead(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T>;
  percentRank(this: ExprRef<unknown>): WindowBuilder<SqlFloat>;
  ntile(this: ExprRef<unknown>, buckets: ExprInput<SqlInt>): WindowBuilder<SqlInt>;
  sumOver<TValue extends NullableSqlNumber>(this: ExprRef<TValue>, spec?: WindowSpecInput): ExprRef<TValue>;

  replace<TValue extends NullableString>(
    this: ExprRef<TValue>,
    search: ExprInput<string>,
    replacement: ExprInput<string>
  ): ExprRef<PropagateNull<TValue, string>>;
  upper<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
  lower<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
  reverse<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
  trim<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, string>>;
  regexLike(this: ExprRef<NullableString>, pattern: ExprInput<string>): ExprRef<boolean>;
  regexReplace<TValue extends NullableString>(
    this: ExprRef<TValue>,
    pattern: ExprInput<string>,
    replacement: ExprInput<string>,
    flags?: ExprInput<string>
  ): ExprRef<PropagateNull<TValue, string>>;
  regexExtract<TValue extends NullableString>(
    this: ExprRef<TValue>,
    pattern: ExprInput<string>,
    groupIndex?: ExprInput<SqlInt>
  ): ExprRef<PropagateNull<TValue, string>>;
  substring<TValue extends NullableString>(
    this: ExprRef<TValue>,
    start: ExprInput<SqlInt>,
    length?: ExprInput<SqlInt>
  ): ExprRef<PropagateNull<TValue, string>>;
  position<TValue extends NullableString>(this: ExprRef<TValue>, needle: ExprInput<string>): ExprRef<PropagateNull<TValue, SqlInt>>;
  overlay<TValue extends NullableString>(
    this: ExprRef<TValue>,
    placing: ExprInput<string>,
    start: ExprInput<SqlInt>,
    length?: ExprInput<SqlInt>
  ): ExprRef<PropagateNull<TValue, string>>;
  charLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  characterLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  octetLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  bitLength<TValue extends NullableString>(this: ExprRef<TValue>): ExprRef<PropagateNull<TValue, SqlInt>>;
  left<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
  right<TValue extends NullableString>(this: ExprRef<TValue>, length: ExprInput<SqlInt>): ExprRef<PropagateNull<TValue, string>>;
  lpad<TValue extends NullableString>(
    this: ExprRef<TValue>,
    length: ExprInput<SqlInt>,
    padding?: ExprInput<string>
  ): ExprRef<PropagateNull<TValue, string>>;
  rpad<TValue extends NullableString>(
    this: ExprRef<TValue>,
    length: ExprInput<SqlInt>,
    padding?: ExprInput<string>
  ): ExprRef<PropagateNull<TValue, string>>;
  concat<TValue extends NullableString>(this: ExprRef<TValue>, ...parts: ExprInput<unknown>[]): ExprRef<PropagateNull<TValue, string>>;

  arrayLength(this: ExprRef<unknown>): ExprRef<SqlInt>;
  arrayContains(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<boolean>;
  arrayPosition(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<SqlInt>;
  arraySlice(this: ExprRef<unknown>, start: ExprInput<SqlInt>, length?: ExprInput<SqlInt>): ExprRef<unknown>;
  arrayJoin(this: ExprRef<unknown>, separator: ExprInput<string>): ExprRef<string>;
  arrayAppend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown>;
  arrayPrepend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown>;
  arrayConcat(this: ExprRef<unknown>, ...values: ExprInput<unknown>[]): ExprRef<unknown>;
  arrayDistinct(this: ExprRef<unknown>): ExprRef<unknown>;

  coalesce<TValues extends readonly unknown[]>(
    this: ExprRef<T>,
    ...values: ExprInputTuple<NormalizeNumericLiteralTuple<T, TValues>>
  ): ExprRef<NonNull<T | NormalizeNumericLiteral<T, TValues[number]>>>;
  nullIf(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T | null>;
}

export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}

  toSql(renderer: SqlRenderer<any, SqlResult>): string {
    return renderer.toSql(this);
  }

  toSqlResult<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSqlResult(this);
  }

  via<A extends unknown[], R>(
    operation: (expr: ExprRef<T>, ...args: A) => R,
    ...args: A
  ): R {
    return operation(this, ...args);
  }
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
  constructor(private readonly name: string, private readonly args: ExprNode<unknown>[]) {}

  over(spec: WindowSpecInput = {}): ExprRef<T> {
    const partitionBy = toExprNodeList(spec.partitionBy);
    const orderBy = toOrderItems(spec.orderBy);
    return new ExprRef<T>({
      kind: "window",
      name: this.name,
      args: this.args,
      partitionBy,
      orderBy,
    });
  }
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
