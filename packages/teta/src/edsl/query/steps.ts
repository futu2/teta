import type { QueryStep } from "./builder.ts";

type QueryColumns = Record<string, any>;

export function identityStep<TColumns extends QueryColumns>(): QueryStep<TColumns, TColumns> {
  return (query) => query;
}

export function whenStep<TColumns extends QueryColumns>(
  condition: boolean,
  step: QueryStep<TColumns, TColumns>
): QueryStep<TColumns, TColumns> {
  return condition ? step : identityStep();
}

export function unlessStep<TColumns extends QueryColumns>(
  condition: boolean,
  step: QueryStep<TColumns, TColumns>
): QueryStep<TColumns, TColumns> {
  return whenStep(!condition, step);
}
