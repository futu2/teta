import type { ExprNode, QueryDialect } from "./types";
import { rewriteDialectExpr, validateDialectExpr } from "./language_rewrite";

export {
  LANGUAGE_SPEC,
  getLanguageSpec,
  type LanguageCategory,
} from "./language_spec";

export { resolveDialectLanguage } from "./language_config";

export function applyDialectLanguage(
  expr: ExprNode<any>,
  dialect: QueryDialect
): ExprNode<any> {
  const normalized = rewriteDialectExpr(expr, dialect.language);
  validateDialectExpr(normalized, dialect.language);
  return normalized;
}
