import type {
  AggFunc,
  BinaryOp,
  DateLiteral,
  ExprNode,
  OrderItem,
  TimestampLiteral,
  Value,
} from "../types";
import type { SqlRenderer, SqlResult } from "../../sql/types";
import {
  containsGroup,
  dedupeExprs,
  shouldAlias,
  unwrapGroupExpr,
} from "./node/ops";

type LiteralInput<T> = T extends number ? number : T;
export type ExprInput<T> = ExprRef<T> | LiteralInput<T>;
export type CaseBuilder<T> = {
  when: (condition: ExprInput<boolean>, value: ExprInput<T>) => CaseBuilder<T>;
  else: (value: ExprInput<T>) => ExprRef<T>;
  end: () => ExprRef<T | null>;
};

export type WindowSpecInput = {
  partitionBy?: ExprRef<unknown> | ExprRef<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

export interface ExprRef<T> {}

export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}

  toSql<TReturn extends SqlResult>(renderer: SqlRenderer<any, TReturn>): TReturn {
    return renderer.toSql(this);
  }

  via<A extends unknown[], R>(
    operation: (expr: ExprRef<T>, ...args: A) => R,
    ...args: A
  ): R {
    return operation(this, ...args);
  }
}

export class ColumnRef<T, Name extends string> extends ExprRef<T> {
  readonly table: string | null;
  readonly name: Name;

  constructor(table: string | null, name: Name) {
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

export type SelectValue = ExprRef<unknown> | Value;
export type SelectShape = Record<string, SelectValue>;
export type SelectResult<S extends SelectShape> = {
  [K in keyof S]: S[K] extends ExprRef<infer T> ? T : S[K];
};

export function lit<T extends Value>(value: T): ExprRef<T> {
  return new ExprRef<T>({ kind: "literal", value });
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
    throw new Error("fn requires a function name");
  }
  return funcExpr(name, args.map((arg) => toExprNode(arg)));
}

export function windowFn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): WindowBuilder<T> {
  if (!name.trim()) {
    throw new Error("windowFn requires a function name");
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
    throw new Error("Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return { kind: "literal", value: value as Value };
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value };
  }
  throw new Error(`Unsupported literal value: ${String(value)}`);
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
