import type { CteSpec, InternalCteName, QuerySpec } from "../../core/types";

export type RecursivePart = QuerySpec;

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
