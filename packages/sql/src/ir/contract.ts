/** Required top-level keys in the portable Query IR v1 contract. */
export const PORTABLE_QUERY_IR_REQUIRED_KEYS: readonly [
  "version",
  "source",
  "stages",
  "scopeId",
  "columnNames",
] = Object.freeze([
  "version",
  "source",
  "stages",
  "scopeId",
  "columnNames",
]);

/** Optional top-level keys in the portable Query IR v1 contract. */
export const PORTABLE_QUERY_IR_OPTIONAL_KEYS: readonly ["withs"] = Object.freeze([
  "withs",
]);

/** Renderer-only keys deliberately excluded from portable Query IR. */
export const PORTABLE_QUERY_IR_RENDERER_KEYS: readonly ["columnIdentifiers"] = Object.freeze([
  "columnIdentifiers",
]);
