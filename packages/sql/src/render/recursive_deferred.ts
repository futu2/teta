import type { CteSpec, InternalCteName, QuerySpec } from "../ir/types.ts";

/** Query part used as either the base or recursive step of a loop CTE. */
export type RecursivePart = QuerySpec;

/** Create a recursive CTE spec that will be materialized during rendering. */
export function createDeferredRecursiveCte(
  name: InternalCteName,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart
): CteSpec {
  return {
    kind: "recursive",
    name,
    columnNames: [...columnNames],
    base,
    step,
  };
}
