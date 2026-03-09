import type { ExprNode } from "../../core/types";
import type { DialectLanguageConfig, DialectLanguageFallback } from "../types";
import { rewriteArrayFallback } from "./fallback_array";
import { func } from "./fallback_ast";
import { rewriteDateFallback } from "./fallback_date";
import { rewriteMiscFallback } from "./fallback_misc";

type ResolvedLanguage = Required<DialectLanguageConfig>;

export function applyFallback(
  functionName: string,
  args: ExprNode<any>[],
  language: ResolvedLanguage
): ExprNode<any> {
  const fallback = language.fallbacks[functionName.toUpperCase()];
  if (!fallback) {
    return {
      kind: "func",
      name: functionName,
      args,
    };
  }
  return rewriteFallback(functionName, args, fallback);
}

export function rewriteFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> {
  return rewriteDateFallback(functionName, args, fallback)
    ?? rewriteArrayFallback(functionName, args, fallback)
    ?? rewriteMiscFallback(functionName, args, fallback)
    ?? func(functionName, args);
}

export function resolveFunctionName(name: string, language: ResolvedLanguage): string {
  const normalized = name.toUpperCase();
  return language.functions[normalized] ?? name;
}
