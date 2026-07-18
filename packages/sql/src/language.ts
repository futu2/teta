import type { ExprNode } from "./ir/types.ts";
import type { QueryDialect } from "./types.ts";
import { rewriteDialectExpr, validateDialectExpr } from "./language/rewrite.ts";

export {
  /** Catalog of language functions and features covered by Teta's dialect layer. */
  LANGUAGE_SPEC,
  /** Scalar operations emitted as typed portable IR nodes. */
  BUILTIN_FUNCTION_ARITIES,
  BUILTIN_FUNCTION_OPERATIONS,
  /** Format one operation's accepted argument count. */
  formatBuiltinFunctionArity,
  /** Return the language support catalog. */
  getLanguageSpec,
  /** Return true when a name is a portable scalar operation. */
  isBuiltinFunctionArityValid,
  isBuiltinFunctionOperation,
  /** Arity constraints for one portable scalar operation. */
  type BuiltinFunctionArity,
  /** Category key from `LANGUAGE_SPEC`. */
  type LanguageCategory,
  /** Canonical scalar operation represented by a portable `builtin` node. */
  type BuiltinFunctionOperation,
} from "./language/spec.ts";
export {
  /** Return the generated implementation status for one dialect operation. */
  getDialectCapability,
  /** Return the verification tier for one dialect configuration. */
  getDialectSupportTier,
  /** Return all operation statuses for one dialect. */
  getDialectCapabilities,
  /** Return all built-in dialect operation statuses. */
  getDialectCapabilityMatrix,
  /** Return the canonical operations covered by the capability matrix. */
  getLanguageOperations,
  /** Format the generated matrix for Markdown documentation. */
  formatDialectCapabilityMatrixMarkdown,
  /** Generated status for one dialect operation. */
  type DialectCapability,
  /** Capability map for one dialect. */
  type DialectCapabilityMap,
  /** Capability maps for all built-in dialects. */
  type DialectCapabilityMatrix,
  /** Canonical operation represented in the capability matrix. */
  type LanguageOperation,
} from "./language/capability.ts";

/** Resolve dialect function names, fallback rewrites, and unsupported functions. */
export { resolveDialectLanguage } from "./language/config.ts";

/** Apply dialect-specific function rewrites and validate unsupported expression functions. */
export function applyDialectLanguage(
  expr: ExprNode<any>,
  dialect: QueryDialect
): ExprNode<any> {
  const normalized = rewriteDialectExpr(expr, dialect.language);
  validateDialectExpr(normalized, dialect.language);
  return normalized;
}
