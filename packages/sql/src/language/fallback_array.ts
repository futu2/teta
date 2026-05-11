import type { ExprNode } from "../ir/types.ts";
import type { DialectLanguageFallback } from "../types.ts";
import { arrayExpr, binaryExpr, func, literal } from "./fallback_ast.ts";

export function rewriteArrayFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  switch (fallback) {
    case "array_length_via_json_array_length": {
      const value = args[0];
      if (!value) {
        return func(functionName, args);
      }
      return func("JSON_ARRAY_LENGTH", [value]);
    }
    case "array_length_dim1": {
      const value = args[0];
      if (!value) {
        return func(functionName, args);
      }
      return func("ARRAY_LENGTH", [value, literal(1)]);
    }
    case "array_slice_via_start_length": {
      const arrayValue = args[0];
      const startExpr = args[1];
      const lengthExpr = args[2];
      if (!arrayValue || !startExpr) {
        return func(functionName, args);
      }
      if (!lengthExpr) {
        return func("ARRAY_SLICE", [arrayValue, startExpr]);
      }
      const endExpr = binaryExpr("+", startExpr, binaryExpr("-", lengthExpr, literal(1)));
      return func("ARRAY_SLICE", [arrayValue, startExpr, endExpr]);
    }
    case "array_contains_via_array_position": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      return binaryExpr(
        "IS NOT",
        func("ARRAY_POSITION", [arrayValue, valueExpr]),
        literal(null)
      );
    }
    case "array_contains_via_json_instr": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      const jsonArray = func("JSON_EXTRACT", [arrayValue, literal("$")]);
      const quotedValue = func("JSON_QUOTE", [valueExpr]);
      return binaryExpr(
        ">",
        func("INSTR", [jsonArray, quotedValue]),
        literal(0)
      );
    }
    case "array_position_via_json_instr": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      const jsonArray = func("JSON_EXTRACT", [arrayValue, literal("$")]);
      const quotedValue = func("JSON_QUOTE", [valueExpr]);
      return func("NULLIF", [func("INSTR", [jsonArray, quotedValue]), literal(0)]);
    }
    case "array_join_via_json_string": {
      const arrayValue = args[0];
      if (!arrayValue) {
        return func(functionName, args);
      }
      const separator = args[1] ?? literal(",");
      const jsonText = func("JSON_EXTRACT", [arrayValue, literal("$")]);
      const noOpen = func("REPLACE", [jsonText, literal("["), literal("")]);
      const noClose = func("REPLACE", [noOpen, literal("]"), literal("")]);
      const noQuotes = func("REPLACE", [noClose, literal('"'), literal("")]);
      return func("REPLACE", [noQuotes, literal(","), separator]);
    }
    case "array_append_via_json_insert_end": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      return func("JSON_INSERT", [arrayValue, literal("$[#]"), valueExpr]);
    }
    case "array_append_via_concat_operator": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      return binaryExpr("||", arrayValue, arrayExpr(valueExpr));
    }
    case "array_prepend_via_concat_operator": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      return binaryExpr("||", arrayExpr(valueExpr), arrayValue);
    }
    case "array_prepend_via_list_concat": {
      const arrayValue = args[0];
      const valueExpr = args[1];
      if (!arrayValue || !valueExpr) {
        return func(functionName, args);
      }
      return func("LIST_CONCAT", [func("LIST_VALUE", [valueExpr]), arrayValue]);
    }
    default:
      return null;
  }
}
