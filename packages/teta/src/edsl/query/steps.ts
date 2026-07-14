import { userError } from "../errors.ts";
import { createQueryStep, hasQueryStepBrand, type QueryStep } from "./core.ts";
import type { QueryColumns } from "./types.ts";

export function identityStep<TColumns extends QueryColumns>(): QueryStep<TColumns, TColumns> {
  return createQueryStep("identityStep", (query) => query);
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
