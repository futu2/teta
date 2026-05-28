import type { ExprNode } from "../ir/types.ts";
import type { DialectLanguageFallback } from "../types.ts";
import {
  castExpr,
  extractFieldAsInt,
  extractFieldExpr,
  func,
  literal,
  literalString,
} from "./fallback_ast.ts";
import {
  DATE_TRUNC_FORMATS,
  SQLITE_EXTRACT_FORMATS,
  normalizeUnit,
} from "./fallback_date_units.ts";

export function rewriteBasicDateFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  switch (fallback) {
    case "cast_date_via_date_function": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return func("DATE", [valueExpr]);
    }
    case "date_format_via_strftime": {
      const valueExpr = args[0];
      const formatExpr = args[1];
      if (!valueExpr || !formatExpr) {
        return func(functionName, args);
      }
      return func("STRFTIME", [formatExpr, valueExpr]);
    }
    case "date_format_via_to_char": {
      const valueExpr = args[0];
      const formatExpr = args[1];
      if (!valueExpr || !formatExpr) {
        return func(functionName, args);
      }
      return func("TO_CHAR", [valueExpr, rewritePostgresDateFormat(formatExpr)]);
    }
    case "date_parse_via_to_timestamp": {
      const valueExpr = args[0];
      const formatExpr = args[1];
      if (!valueExpr || !formatExpr) {
        return func(functionName, args);
      }
      return func("TO_TIMESTAMP", [valueExpr, rewritePostgresDateFormat(formatExpr)]);
    }
    case "date_parse_via_datetime": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return func("DATETIME", [valueExpr]);
    }
    case "extract_via_strftime": {
      const fieldExpr = args[0];
      const valueExpr = args[1];
      const rawField = fieldExpr ? literalString(fieldExpr) : null;
      const field = normalizeUnit(rawField) ?? rawField?.trim().toLowerCase() ?? null;
      if (!field || !valueExpr) {
        return func(functionName, args);
      }
      const format = SQLITE_EXTRACT_FORMATS[field];
      if (!format) {
        return func(functionName, args);
      }
      return castExpr(func("STRFTIME", [literal(format), valueExpr]), "INTEGER");
    }
    case "extract_via_integer_cast": {
      const fieldExpr = args[0];
      const valueExpr = args[1];
      const field = fieldExpr ? literalString(fieldExpr) : null;
      if (!field || !valueExpr) {
        return func(functionName, args);
      }
      return extractFieldAsInt(field, valueExpr);
    }
    case "date_trunc_via_strftime": {
      const unitExpr = args[0];
      const valueExpr = args[1];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !valueExpr) {
        return func(functionName, args);
      }
      if (unit === "week") {
        return func("DATE", [valueExpr, literal("-6 days"), literal("weekday 1")]);
      }
      const format = DATE_TRUNC_FORMATS[unit];
      if (!format) {
        return func(functionName, args);
      }
      return func("STRFTIME", [literal(format), valueExpr]);
    }
    case "to_unixtime_via_strftime_s": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return castExpr(func("STRFTIME", [literal("%s"), valueExpr]), "INTEGER");
    }
    case "to_unixtime_via_extract_epoch": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return extractFieldExpr("epoch", valueExpr);
    }
    case "from_unixtime_via_datetime": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return func("DATETIME", [valueExpr, literal("unixepoch")]);
    }
    default:
      return null;
  }
}

function rewritePostgresDateFormat(formatExpr: ExprNode<any>): ExprNode<any> {
  const format = literalString(formatExpr);
  if (!format) {
    return formatExpr;
  }
  return literal(format.replace(/%[YymdHMS]/g, (token) => POSTGRES_DATE_FORMATS[token] ?? token));
}

const POSTGRES_DATE_FORMATS: Record<string, string> = {
  "%Y": "YYYY",
  "%y": "YY",
  "%m": "MM",
  "%d": "DD",
  "%H": "HH24",
  "%M": "MI",
  "%S": "SS",
};
