import * as expr from "./src/edsl/expr.ts";

/**
 * Explicit advanced EDSL entrypoint.
 *
 * These builders target database-specific functions that are not part of the
 * portable Teta language catalog. Function names are still validated as SQL
 * identifiers and remain safe to render.
 *
 * @module
 */

/** Builds a validated database-specific SQL function expression. */
export const fn: typeof import("./src/edsl/expr.ts").fn = expr.fn;

/** Builds a portable function expression using the canonical operation catalog. */
export const checkedFn: typeof import("./src/edsl/expr.ts").checkedFn = expr.checkedFn;

/** Builds a custom function with an explicitly asserted result type. */
export const unsafeFn: typeof import("./src/edsl/expr.ts").unsafeFn = expr.unsafeFn;

/** Builds a validated database-specific window function before `over(...)`. */
export const windowFn: typeof import("./src/edsl/expr.ts").windowFn = expr.windowFn;
