import type { ExprNode } from "../core/types";
import type { QueryDialect } from "./types";
import { rewriteDialectExpr, validateDialectExpr } from "./language/rewrite";

export {
  LANGUAGE_SPEC,
  getLanguageSpec,
  type LanguageCategory,
} from "./language/spec";

export { resolveDialectLanguage } from "./language/config";

export function applyDialectLanguage(
  expr: ExprNode<any>,
  dialect: QueryDialect
): ExprNode<any> {
  const normalized = rewriteDialectExpr(expr, dialect.language);
  validateDialectExpr(normalized, dialect.language);
  return normalized;
}
