import type { CteSpec, InternalCteName, QuerySpec } from "../ir/types.ts";

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
