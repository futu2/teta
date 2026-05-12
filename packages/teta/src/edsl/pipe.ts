type UnaryStep<TInput, TOutput> = (input: TInput) => TOutput;

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
export function pipe(value: unknown, ...steps: UnaryStep<unknown, unknown>[]): unknown {
  let current = value;
  for (const step of steps) {
    current = step(current);
  }
  return current;
}
