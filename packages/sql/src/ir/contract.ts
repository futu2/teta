/** Required top-level keys in the portable Query IR v1 contract. */
export const PORTABLE_QUERY_IR_REQUIRED_KEYS = Object.freeze([
  "version",
  "source",
  "stages",
  "scopeId",
  "columnNames",
] as const);

/** Optional top-level keys in the portable Query IR v1 contract. */
export const PORTABLE_QUERY_IR_OPTIONAL_KEYS = Object.freeze([
  "withs",
] as const);

/** Renderer-only keys deliberately excluded from portable Query IR. */
export const PORTABLE_QUERY_IR_RENDERER_KEYS = Object.freeze([
  "columnIdentifiers",
] as const);
