import type { SqlFloat, SqlInt, SqlNumber } from "../../types.ts";
import { ExprRef, fn, toExprNode, type ExprInput, type PropagateNull } from "../core.ts";
import { userError } from "../../../errors.ts";

type NullableSqlNumber = SqlNumber | number | bigint | null;

export function add<TValue extends NullableSqlNumber>(
  left: ExprInput<TValue>,
  right: ExprInput<TValue>
): ExprRef<TValue> {
  return binaryExpr("+", toExprNode(left), toExprNode(right)) as ExprRef<TValue>;
}

export function sub<TValue extends NullableSqlNumber>(
  left: ExprInput<TValue>,
  right: ExprInput<TValue>
): ExprRef<TValue> {
  return binaryExpr("-", toExprNode(left), toExprNode(right)) as ExprRef<TValue>;
}

export function mul<TValue extends NullableSqlNumber>(
  left: ExprInput<TValue>,
  right: ExprInput<TValue>
): ExprRef<TValue> {
  return binaryExpr("*", toExprNode(left), toExprNode(right)) as ExprRef<TValue>;
}

export function div<TValue extends NullableSqlNumber>(
  left: ExprInput<TValue>,
  right: ExprInput<TValue>
): ExprRef<TValue> {
  return binaryExpr("/", toExprNode(left), toExprNode(right)) as ExprRef<TValue>;
}

export function mod<TValue extends NullableSqlNumber>(
  left: ExprInput<TValue>,
  right: ExprInput<TValue>
): ExprRef<TValue> {
  return fn<TValue>("MOD", left, right);
}

export function ceil<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("CEIL", value);
}

export function floor<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlInt>> {
  return fn<PropagateNull<TValue, SqlInt>>("FLOOR", value);
}

export function abs<TValue extends NullableSqlNumber>(value: ExprInput<TValue>): ExprRef<TValue> {
  return fn<TValue>("ABS", value);
}

export function sqrt<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlFloat>> {
  return fn<PropagateNull<TValue, SqlFloat>>("SQRT", value);
}

export function pow<
  TValue extends NullableSqlNumber,
  TExponent extends NullableSqlNumber,
>(
  value: ExprInput<TValue>,
  exponent: ExprInput<TExponent>
): ExprRef<PropagateNull<TValue | TExponent, SqlFloat>> {
  return fn<PropagateNull<TValue | TExponent, SqlFloat>>("POWER", value, exponent);
}

export function greatest<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>,
  ...values: ExprInput<TValue>[]
): ExprRef<TValue> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "greatest requires at least one value");
  }
  return fn<TValue>("GREATEST", value, ...values);
}

export function least<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>,
  ...values: ExprInput<TValue>[]
): ExprRef<TValue> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "least requires at least one value");
  }
  return fn<TValue>("LEAST", value, ...values);
}

export function cast<TTarget = unknown>(
  value: ExprInput<unknown>,
  target: string
): ExprRef<TTarget> {
  if (!target.trim()) {
    userError("INVALID_FUNCTION_NAME", "cast requires a target type");
  }
  return new ExprRef<TTarget>({
    kind: "cast",
    expr: toExprNode(value),
    target,
  });
}

export function toInt<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlInt>> {
  return cast<PropagateNull<TValue, SqlInt>>(value, "INTEGER");
}

export function toFloat<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlFloat>> {
  return cast<PropagateNull<TValue, SqlFloat>>(value, "FLOAT");
}

export function round<TValue extends NullableSqlNumber>(
  value: ExprInput<TValue>,
  scale?: ExprInput<SqlInt>
): ExprRef<TValue> {
  if (scale === undefined) {
    return fn<TValue>("ROUND", value);
  }
  return fn<TValue>("ROUND", value, scale);
}

function binaryExpr(
  op: "+" | "-" | "*" | "/",
  left: ReturnType<typeof toExprNode>,
  right: ReturnType<typeof toExprNode>
): ExprRef<unknown> {
  return new ExprRef({ kind: "binary", op, left, right });
}
