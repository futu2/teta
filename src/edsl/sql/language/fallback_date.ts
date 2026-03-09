import type { ExprNode } from "../../core/types";
import type { DialectLanguageFallback } from "../types";
import { rewriteArithmeticDateFallback } from "./fallback_date_arithmetic";
import { rewriteBasicDateFallback } from "./fallback_date_basic";

export function rewriteDateFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  return rewriteBasicDateFallback(functionName, args, fallback)
    ?? rewriteArithmeticDateFallback(functionName, args, fallback);
}
