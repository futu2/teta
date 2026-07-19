import { userError } from "./errors.ts";

type UnaryStep<TInput, TOutput> = (input: TInput) => TOutput;

type AnyUnaryStep = UnaryStep<any, any>;

type PipeTail<TInput, TSteps extends readonly AnyUnaryStep[]> =
  TSteps extends readonly [infer TStep, ...infer TRest extends readonly AnyUnaryStep[]]
    ? TStep extends UnaryStep<TInput, infer TOutput>
      ? readonly [TStep, ...PipeTail<TOutput, TRest>]
      : never
    : readonly [];

type PipeTailResult<TInput, TSteps extends readonly AnyUnaryStep[]> =
  TSteps extends readonly [infer TStep, ...infer TRest extends readonly AnyUnaryStep[]]
    ? TStep extends UnaryStep<TInput, infer TOutput>
      ? PipeTailResult<TOutput, TRest>
      : never
    : TInput;

/** Applies unary steps to a value from left to right. */
// <generated:pipe-overloads>
export function pipe<TValue>(value: TValue): TValue;
export function pipe<TValue, T1>(
  value: TValue,
  step1: UnaryStep<TValue, T1>
): T1;
export function pipe<TValue, T1, T2>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>
): T2;
export function pipe<TValue, T1, T2, T3>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>
): T3;
export function pipe<TValue, T1, T2, T3, T4>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>
): T4;
export function pipe<TValue, T1, T2, T3, T4, T5>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>
): T5;
export function pipe<TValue, T1, T2, T3, T4, T5, T6>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>
): T6;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>
): T7;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>
): T8;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>
): T9;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>
): T10;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>
): T11;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>,
  step12: UnaryStep<T11, T12>
): T12;
export function pipe<
  TValue,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
  T8,
  T9,
  T10,
  T11,
  T12,
  const TRest extends readonly AnyUnaryStep[],
>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>,
  step12: UnaryStep<T11, T12>,
  ...steps: TRest & PipeTail<T12, TRest>
): PipeTailResult<T12, TRest>;
// </generated:pipe-overloads>
export function pipe(value: unknown, ...steps: UnaryStep<unknown, unknown>[]): unknown {
  assertUnarySteps("pipe", steps);
  let current = value;
  for (const step of steps) {
    current = step(current);
  }
  return current;
}

/** Composes unary steps from left to right into a reusable function. */
// <generated:flow-overloads>
export function flow<TValue>(): UnaryStep<TValue, TValue>;
export function flow<TValue, T1>(
  step1: UnaryStep<TValue, T1>
): UnaryStep<TValue, T1>;
export function flow<TValue, T1, T2>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>
): UnaryStep<TValue, T2>;
export function flow<TValue, T1, T2, T3>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>
): UnaryStep<TValue, T3>;
export function flow<TValue, T1, T2, T3, T4>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>
): UnaryStep<TValue, T4>;
export function flow<TValue, T1, T2, T3, T4, T5>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>
): UnaryStep<TValue, T5>;
export function flow<TValue, T1, T2, T3, T4, T5, T6>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>
): UnaryStep<TValue, T6>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>
): UnaryStep<TValue, T7>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>
): UnaryStep<TValue, T8>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>
): UnaryStep<TValue, T9>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>
): UnaryStep<TValue, T10>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>
): UnaryStep<TValue, T11>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>,
  step12: UnaryStep<T11, T12>
): UnaryStep<TValue, T12>;
export function flow<
  TValue,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
  T8,
  T9,
  T10,
  T11,
  T12,
  const TRest extends readonly AnyUnaryStep[],
>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>,
  step9: UnaryStep<T8, T9>,
  step10: UnaryStep<T9, T10>,
  step11: UnaryStep<T10, T11>,
  step12: UnaryStep<T11, T12>,
  ...steps: TRest & PipeTail<T12, TRest>
): UnaryStep<TValue, PipeTailResult<T12, TRest>>;
// </generated:flow-overloads>
export function flow(...steps: UnaryStep<unknown, unknown>[]): UnaryStep<unknown, unknown> {
  assertUnarySteps("flow", steps);
  return (value: unknown) => {
    let current = value;
    for (const step of steps) {
      current = step(current);
    }
    return current;
  };
}

function assertUnarySteps(
  helper: "pipe" | "flow",
  steps: readonly unknown[],
): asserts steps is readonly UnaryStep<unknown, unknown>[] {
  if (steps.some((step) => typeof step !== "function")) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects only function steps`);
  }
}
