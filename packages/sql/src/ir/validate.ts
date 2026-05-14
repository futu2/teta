import { TetaUserError } from "../errors.ts";
import type { QueryIR } from "./types_query.ts";

/** Assert that an unknown value has the minimum shape of a query IR. */
export function validateQueryIR(value: unknown): asserts value is QueryIR {
  if (typeof value !== "object" || value === null) {
    throw new TetaUserError("INVALID_TABLE_SOURCE", "Query IR must be an object");
  }
  if (!("source" in value) || !("stages" in value) || !("scopeId" in value)) {
    throw new TetaUserError(
      "INVALID_TABLE_SOURCE",
      "Query IR must include source, stages, and scopeId"
    );
  }
  const stages = (value as { stages?: unknown }).stages;
  if (!Array.isArray(stages)) {
    throw new TetaUserError("INVALID_TABLE_SOURCE", "Query IR stages must be an array");
  }
}
