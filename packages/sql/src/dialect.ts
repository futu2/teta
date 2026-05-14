/** Default dialect used when no explicit dialect is provided. */
export { DEFAULT_DIALECT } from "./dialect/default.ts";
/** Registry of canonical built-in dialect definitions. */
export { BUILTIN_DIALECTS } from "./dialect/builtin.ts";
/** Resolve dialect function names, fallback rewrites, and unsupported functions. */
export { resolveDialectLanguage, IDENTITY_LANGUAGE } from "./dialect/language.ts";
/** Look up or suggest canonical built-in dialect names. */
export { lookupBuiltinDialect, suggestCanonicalBuiltin } from "./dialect/lookup.ts";
/** Resolve dialect and renderer option metadata. */
export { buildSqlOptions, cloneDialect, getDefaultDialect, resolveDialect, sameDialect } from "./dialect/resolve.ts";
/** Internal definition for one built-in dialect preset. */
export type { BuiltinDialectDefinition } from "./dialect/types.ts";
