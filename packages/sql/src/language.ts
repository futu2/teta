import type { ExprNode } from "./ir/types.ts";
import type { QueryDialect } from "./types.ts";
import { rewriteDialectExpr, validateDialectExpr } from "./language/rewrite.ts";

export {
  LANGUAGE_SPEC,
  getLanguageSpec,
  type LanguageCategory,
} from "./language/spec.ts";

export { resolveDialectLanguage } from "./language/config.ts";

export function applyDialectLanguage(
  expr: ExprNode<any>,
  dialect: QueryDialect
): ExprNode<any> {
  const normalized = rewriteDialectExpr(expr, dialect.language);
  validateDialectExpr(normalized, dialect.language);
  return normalized;
}
