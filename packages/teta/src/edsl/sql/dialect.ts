export { DEFAULT_DIALECT } from "./dialect/default.ts";
export { BUILTIN_DIALECTS } from "./dialect/builtin.ts";
export { resolveDialectLanguage, IDENTITY_LANGUAGE } from "./dialect/language.ts";
export { lookupBuiltinDialect, suggestCanonicalBuiltin } from "./dialect/lookup.ts";
export { buildSqlOptions, cloneDialect, getDefaultDialect, resolveDialect, sameDialect } from "./dialect/resolve.ts";
export type { BuiltinDialectDefinition } from "./dialect/types.ts";
