import { userError } from "../errors.ts";
import {
  createQueryStep,
  hasQueryBrand,
  hasQueryStepBrand,
  type Query,
  type QueryStep,
} from "./core.ts";
import type { QueryColumns } from "./types.ts";

type QueryTransform<
  TInput extends QueryColumns,
  TOutput extends QueryColumns,
> = (query: Query<TInput>) => Query<TOutput>;

type AnyQueryTransform = QueryTransform<any, any>;

export type IdentityQueryTransform = {
  <TColumns extends QueryColumns>(query: Query<TColumns>): Query<TColumns>;
};

type QueryStepTail<
  TInput extends QueryColumns,
  TSteps extends readonly AnyQueryTransform[],
> = TSteps extends readonly [
  infer TStep,
  ...infer TRest extends readonly AnyQueryTransform[],
]
  ? TStep extends QueryTransform<TInput, infer TOutput extends QueryColumns>
    ? readonly [TStep, ...QueryStepTail<TOutput, TRest>]
    : never
  : readonly [];

type QueryStepTailResult<
  TInput extends QueryColumns,
  TSteps extends readonly AnyQueryTransform[],
> = TSteps extends readonly [
  infer TStep,
  ...infer TRest extends readonly AnyQueryTransform[],
]
  ? TStep extends QueryTransform<TInput, infer TOutput extends QueryColumns>
    ? QueryStepTailResult<TOutput, TRest>
    : never
  : TInput;

export function identityStep<TColumns extends QueryColumns>(): QueryStep<TColumns, TColumns> {
  return createQueryStep("identityStep", (query) => query);
}

/** Composes compatible query transforms from left to right into one branded query step. */
export function composeSteps(): IdentityQueryTransform;
export function composeSteps<TInput extends QueryColumns, T1 extends QueryColumns>(
  step1: QueryStep<TInput, T1>
): QueryStep<TInput, T1>;
export function composeSteps<TInput extends QueryColumns, T1 extends QueryColumns>(
  step1: QueryTransform<TInput, T1>
): QueryStep<TInput, T1>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>
): QueryStep<TInput, T2>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>
): QueryStep<TInput, T3>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>
): QueryStep<TInput, T4>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>
): QueryStep<TInput, T5>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>
): QueryStep<TInput, T6>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>
): QueryStep<TInput, T7>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>
): QueryStep<TInput, T8>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
  T9 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>,
  step9: QueryTransform<T8, T9>
): QueryStep<TInput, T9>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
  T9 extends QueryColumns,
  T10 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>,
  step9: QueryTransform<T8, T9>,
  step10: QueryTransform<T9, T10>
): QueryStep<TInput, T10>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
  T9 extends QueryColumns,
  T10 extends QueryColumns,
  T11 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>,
  step9: QueryTransform<T8, T9>,
  step10: QueryTransform<T9, T10>,
  step11: QueryTransform<T10, T11>
): QueryStep<TInput, T11>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
  T9 extends QueryColumns,
  T10 extends QueryColumns,
  T11 extends QueryColumns,
  T12 extends QueryColumns,
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>,
  step9: QueryTransform<T8, T9>,
  step10: QueryTransform<T9, T10>,
  step11: QueryTransform<T10, T11>,
  step12: QueryTransform<T11, T12>
): QueryStep<TInput, T12>;
export function composeSteps<
  TInput extends QueryColumns,
  T1 extends QueryColumns,
  T2 extends QueryColumns,
  T3 extends QueryColumns,
  T4 extends QueryColumns,
  T5 extends QueryColumns,
  T6 extends QueryColumns,
  T7 extends QueryColumns,
  T8 extends QueryColumns,
  T9 extends QueryColumns,
  T10 extends QueryColumns,
  T11 extends QueryColumns,
  T12 extends QueryColumns,
  const TRest extends readonly AnyQueryTransform[],
>(
  step1: QueryTransform<TInput, T1>,
  step2: QueryTransform<T1, T2>,
  step3: QueryTransform<T2, T3>,
  step4: QueryTransform<T3, T4>,
  step5: QueryTransform<T4, T5>,
  step6: QueryTransform<T5, T6>,
  step7: QueryTransform<T6, T7>,
  step8: QueryTransform<T7, T8>,
  step9: QueryTransform<T8, T9>,
  step10: QueryTransform<T9, T10>,
  step11: QueryTransform<T10, T11>,
  step12: QueryTransform<T11, T12>,
  ...steps: TRest & QueryStepTail<T12, TRest>
): QueryStep<TInput, QueryStepTailResult<T12, TRest>>;
export function composeSteps(...steps: AnyQueryTransform[]): QueryStep<any, any> {
  for (const step of steps) {
    if (typeof step !== "function") {
      userError(
        "QUERY_HELPER_INVALID_ARGUMENTS",
        "composeSteps() expects only query transforms"
      );
    }
  }

  return createQueryStep("composeSteps", (query: Query<any>) => {
    let current = query;
    for (const step of steps) {
      const next = step(current);
      if (!hasQueryBrand(next)) {
        userError(
          "QUERY_HELPER_INVALID_ARGUMENTS",
          "composeSteps() transforms must return a query"
        );
      }
      current = next;
    }
    return current;
  });
}

export function whenStep<TColumns extends QueryColumns>(
  condition: boolean,
  step: QueryStep<TColumns, TColumns>
): QueryStep<TColumns, TColumns> {
  return conditionalStep("whenStep", condition, step, false);
}

export function unlessStep<TColumns extends QueryColumns>(
  condition: boolean,
  step: QueryStep<TColumns, TColumns>
): QueryStep<TColumns, TColumns> {
  return conditionalStep("unlessStep", condition, step, true);
}

function conditionalStep<TColumns extends QueryColumns>(
  helper: "whenStep" | "unlessStep",
  condition: boolean,
  step: QueryStep<TColumns, TColumns>,
  invert: boolean
): QueryStep<TColumns, TColumns> {
  if (typeof condition !== "boolean" || !hasQueryStepBrand(step)) {
    userError(
      "QUERY_HELPER_INVALID_ARGUMENTS",
      `${helper}() expects ${helper}(condition, step)`
    );
  }
  const enabled = invert ? !condition : condition;
  return enabled ? step : identityStep();
}
