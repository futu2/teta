import type { ExprNode } from "./ir/types.ts";
import type { QueryDialect } from "./types.ts";
import { rewriteDialectExpr, validateDialectExpr } from "./language/rewrite.ts";

export {
  /** Catalog of language functions and features covered by Teta's dialect layer. */
  LANGUAGE_SPEC,
  /** Return the language support catalog. */
  getLanguageSpec,
  /** Category key from `LANGUAGE_SPEC`. */
  type LanguageCategory,
} from "./language/spec.ts";

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
