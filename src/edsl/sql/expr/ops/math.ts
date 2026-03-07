import type { SqlFloat, SqlInt, SqlNumber } from "../../types";
import { ExprRef, binaryExpr, fn, toExprNode, type ExprInput } from "../core";

export function add<T extends SqlNumber>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<T> {
  return binaryExpr("+", toExprNode(left), toExprNode(right)) as ExprRef<T>;
}

export function sub<T extends SqlNumber>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<T> {
  return binaryExpr("-", toExprNode(left), toExprNode(right)) as ExprRef<T>;
}

export function mul<T extends SqlNumber>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<T> {
  return binaryExpr("*", toExprNode(left), toExprNode(right)) as ExprRef<T>;
}

export function div<T extends SqlNumber>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<T> {
  return binaryExpr("/", toExprNode(left), toExprNode(right)) as ExprRef<T>;
}

export function mod<T extends SqlNumber>(
  left: ExprInput<T>,
  right: ExprInput<T>
): ExprRef<T> {
  return fn<T>("MOD", left, right);
}

export function ceil(value: ExprInput<SqlNumber>): ExprRef<SqlInt> {
  return fn<SqlInt>("CEIL", value);
}

export function floor(value: ExprInput<SqlNumber>): ExprRef<SqlInt> {
  return fn<SqlInt>("FLOOR", value);
}

export function abs<T extends SqlNumber>(value: ExprInput<T>): ExprRef<T> {
  return fn<T>("ABS", value);
}

export function sqrt(value: ExprInput<SqlNumber>): ExprRef<SqlFloat> {
  return fn<SqlFloat>("SQRT", value);
}

export function pow(
  value: ExprInput<SqlNumber>,
  exponent: ExprInput<SqlNumber>
): ExprRef<SqlFloat> {
  return fn<SqlFloat>("POWER", value, exponent);
}

export function greatest<T extends SqlNumber>(
  value: ExprInput<T>,
  ...values: ExprInput<T>[]
): ExprRef<T> {
  if (values.length === 0) {
    throw new Error("greatest requires at least one value");
  }
  return fn<T>("GREATEST", value, ...values);
}

export function least<T extends SqlNumber>(
  value: ExprInput<T>,
  ...values: ExprInput<T>[]
): ExprRef<T> {
  if (values.length === 0) {
    throw new Error("least requires at least one value");
  }
  return fn<T>("LEAST", value, ...values);
}

export function cast<TTarget = unknown>(
  value: ExprInput<unknown>,
  target: string
): ExprRef<TTarget> {
  if (!target.trim()) {
    throw new Error("cast requires a target type");
  }
  return new ExprRef<TTarget>({
    kind: "cast",
    expr: toExprNode(value),
    target,
  });
}

export function toInt(value: ExprInput<SqlNumber>): ExprRef<SqlInt> {
  return cast<SqlInt>(value, "INTEGER");
}

export function toFloat(value: ExprInput<SqlNumber>): ExprRef<SqlFloat> {
  return cast<SqlFloat>(value, "FLOAT");
}

export function round(
  value: ExprInput<SqlNumber>,
  scale?: ExprInput<SqlInt>
): ExprRef<SqlNumber> {
  if (scale === undefined) {
    return fn<SqlNumber>("ROUND", value);
  }
  return fn<SqlNumber>("ROUND", value, scale);
}
