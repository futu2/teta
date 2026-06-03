import type {
  NormalizeExpressionLiteral,
  NormalizeNumericLiteral,
  SqlBoolean,
  SqlDate,
  SqlString,
  SqlTimestamp,
  SqlUuid,
} from "../../types.ts";
import type { ExprInput, ExprInputTuple, Expr, NonNull } from "../core.ts";
import { fn } from "../core.ts";
import { userError } from "../../../errors.ts";

type NormalizeCoalesceValue<TContext, TValue> =
  TValue extends string
    ? [Extract<Exclude<TContext, null>, SqlString | SqlDate | SqlTimestamp | SqlUuid>] extends [never]
      ? NormalizeExpressionLiteral<TValue>
      : Extract<Exclude<TContext, null>, SqlString | SqlDate | SqlTimestamp | SqlUuid>
  : TValue extends boolean
    ? [Extract<Exclude<TContext, null>, SqlBoolean>] extends [never]
      ? NormalizeExpressionLiteral<TValue>
      : Extract<Exclude<TContext, null>, SqlBoolean>
  : NormalizeExpressionLiteral<NormalizeNumericLiteral<TContext, TValue>>;

type NormalizeCoalesceTuple<TContext, TValues extends readonly unknown[]> = {
  [K in keyof TValues]: NormalizeCoalesceValue<TContext, TValues[K]>;
};

export function coalesce<TValue, TValues extends readonly unknown[]>(
  value: ExprInput<TValue>,
  ...values: ExprInputTuple<NormalizeCoalesceTuple<TValue, TValues>>
): Expr<NonNull<TValue | NormalizeCoalesceValue<TValue, TValues[number]>>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "coalesce requires at least one fallback value");
  }
  return fn<NonNull<TValue | NormalizeCoalesceValue<TValue, TValues[number]>>>(
    "COALESCE",
    value,
    ...values
  );
}

export function nullIf<T>(value: ExprInput<T>, other: ExprInput<T>): Expr<T | null> {
  return fn<T | null>("NULLIF", value, other);
}
