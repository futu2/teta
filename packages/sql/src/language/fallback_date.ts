import type { ExprNode } from "../ir/types.ts";
import type { DialectLanguageFallback } from "../types.ts";
import { rewriteArithmeticDateFallback } from "./fallback_date_arithmetic.ts";
import { rewriteBasicDateFallback } from "./fallback_date_basic.ts";

export function rewriteDateFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  return rewriteBasicDateFallback(functionName, args, fallback)
    ?? rewriteArithmeticDateFallback(functionName, args, fallback);
}
