export { DEFAULT_DIALECT } from "./dialect/default";
export { BUILTIN_DIALECTS } from "./dialect/builtin";
export { resolveDialectLanguage, IDENTITY_LANGUAGE } from "./dialect/language";
export { lookupBuiltinDialect, suggestCanonicalBuiltin } from "./dialect/lookup";
export { buildSqlOptions, cloneDialect, getDefaultDialect, resolveDialect, sameDialect } from "./dialect/resolve";
export type { BuiltinDialectDefinition } from "./dialect/types";
