import type { ProjectionShape } from "../expr.ts";
import { userError } from "../errors.ts";

export const LEGACY_SELECTION_ARRAY_ERROR = "map() and fold() now expect an object shape";

export function assertProjectionShape(value: unknown): asserts value is ProjectionShape {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length === 0
  ) {
    userError("LEGACY_SELECTION_ARRAY", LEGACY_SELECTION_ARRAY_ERROR);
  }
}
