import type { ExprNode } from "../../core/types.ts";
import type { DialectLanguageFallback } from "../types.ts";
import { binaryExpr, func, literal } from "./fallback_ast.ts";

export function rewriteMiscFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  switch (fallback) {
    case "bit_length_via_length_x8": {
      const value = args[0];
      if (!value) {
        return func(functionName, args);
      }
      return binaryExpr("*", func("LENGTH", [value]), literal(8));
    }
    case "position_via_instr": {
      const needleExpr = args[0];
      const valueExpr = args[1];
      if (!needleExpr || !valueExpr) {
        return func(functionName, args);
      }
      return func("INSTR", [valueExpr, needleExpr]);
    }
    case "overlay_via_concat_substring": {
      const valueExpr = args[0];
      const placingExpr = args[1];
      const startExpr = args[2];
      if (!valueExpr || !placingExpr || !startExpr) {
        return func(functionName, args);
      }
      const lengthExpr = args[3] ?? func("CHAR_LENGTH", [placingExpr]);
      const prefix = func("SUBSTRING", [valueExpr, literal(1), binaryExpr("-", startExpr, literal(1))]);
      const suffix = func("SUBSTRING", [valueExpr, binaryExpr("+", startExpr, lengthExpr)]);
      return binaryExpr("||", binaryExpr("||", prefix, placingExpr), suffix);
    }
    case "regex_like_via_regexp_match": {
      const valueExpr = args[0];
      const patternExpr = args[1];
      if (!valueExpr || !patternExpr) {
        return func(functionName, args);
      }
      return binaryExpr(
        "IS NOT",
        func("REGEXP_MATCH", [valueExpr, patternExpr]),
        literal(null)
      );
    }
    case "regex_like_via_regexp_function": {
      const valueExpr = args[0];
      const patternExpr = args[1];
      if (!valueExpr || !patternExpr) {
        return func(functionName, args);
      }
      return func("REGEXP", [patternExpr, valueExpr]);
    }
    default:
      return null;
  }
}
