import type { ExprNode } from "../ir/types.ts";
import type { DialectLanguageFallback } from "../types.ts";
import {
  binaryExpr,
  castExpr,
  extractFieldAsInt,
  extractFieldExpr,
  func,
  literal,
  literalString,
} from "./fallback_ast.ts";
import {
  DATE_ADD_EPOCH_FACTORS,
  DATE_ADD_TEMPLATES,
  DATE_DIFF_EPOCH_FACTORS,
  normalizeUnit,
} from "./fallback_date_units.ts";

export function rewriteArithmeticDateFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> | null {
  switch (fallback) {
    case "date_add_via_hive_datetime": {
      const unitExpr = args[0];
      const amountExpr = args[1];
      const valueExpr = args[2];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !amountExpr || !valueExpr) {
        return func(functionName, args);
      }
      switch (unit) {
        case "year":
          return buildHiveAddMonths(valueExpr, binaryExpr("*", amountExpr, literal(12)));
        case "quarter":
          return buildHiveAddMonths(valueExpr, binaryExpr("*", amountExpr, literal(3)));
        case "month":
          return buildHiveAddMonths(valueExpr, amountExpr);
        case "week":
        case "day":
        case "hour":
        case "minute":
        case "second": {
          const factor = DATE_ADD_EPOCH_FACTORS[unit];
          if (!factor) {
            return func(functionName, args);
          }
          const delta = factor === 1 ? amountExpr : binaryExpr("*", amountExpr, literal(factor));
          return castExpr(
            func("FROM_UNIXTIME", [
              binaryExpr("+", func("UNIX_TIMESTAMP", [valueExpr]), delta),
            ]),
            "TIMESTAMP"
          );
        }
        default:
          return func(functionName, args);
      }
    }
    case "date_add_via_datetime": {
      const unitExpr = args[0];
      const amountExpr = args[1];
      const valueExpr = args[2];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !amountExpr || !valueExpr) {
        return func(functionName, args);
      }
      const template = DATE_ADD_TEMPLATES[unit];
      if (!template) {
        return func(functionName, args);
      }
      const scaledAmount =
        template.factor === 1
          ? amountExpr
          : binaryExpr("*", amountExpr, literal(template.factor));
      const modifier = func("PRINTF", [literal(`%+d ${template.unit}`), scaledAmount]);
      return func("DATETIME", [valueExpr, modifier]);
    }
    case "date_add_via_epoch_timestamp": {
      const unitExpr = args[0];
      const amountExpr = args[1];
      const valueExpr = args[2];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !amountExpr || !valueExpr) {
        return func(functionName, args);
      }
      const factor = DATE_ADD_EPOCH_FACTORS[unit];
      if (!factor) {
        return func(functionName, args);
      }
      const delta = factor === 1 ? amountExpr : binaryExpr("*", amountExpr, literal(factor));
      return func("TO_TIMESTAMP", [binaryExpr("+", extractFieldExpr("epoch", valueExpr), delta)]);
    }
    case "date_diff_via_extract_epoch": {
      const unitExpr = args[0];
      const startExpr = args[1];
      const endExpr = args[2];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !startExpr || !endExpr) {
        return func(functionName, args);
      }
      if (unit === "year") {
        return binaryExpr(
          "-",
          extractFieldAsInt("year", endExpr),
          extractFieldAsInt("year", startExpr)
        );
      }
      if (unit === "month") {
        const yearDiff = binaryExpr(
          "-",
          extractFieldAsInt("year", endExpr),
          extractFieldAsInt("year", startExpr)
        );
        const monthDiff = binaryExpr(
          "-",
          extractFieldAsInt("month", endExpr),
          extractFieldAsInt("month", startExpr)
        );
        return binaryExpr("+", binaryExpr("*", yearDiff, literal(12)), monthDiff);
      }
      const secondDiff = binaryExpr(
        "-",
        extractFieldExpr("epoch", endExpr),
        extractFieldExpr("epoch", startExpr)
      );
      const unitFactor = DATE_DIFF_EPOCH_FACTORS[unit];
      if (!unitFactor) {
        return func(functionName, args);
      }
      if (unitFactor === 1) {
        return castExpr(secondDiff, "INTEGER");
      }
      const scaledEnd = binaryExpr(
        "/",
        extractFieldExpr("epoch", endExpr),
        literal(unitFactor)
      );
      const scaledStart = binaryExpr(
        "/",
        extractFieldExpr("epoch", startExpr),
        literal(unitFactor)
      );
      return castExpr(binaryExpr("-", scaledEnd, scaledStart), "INTEGER");
    }
    case "date_diff_via_julianday": {
      const unitExpr = args[0];
      const startExpr = args[1];
      const endExpr = args[2];
      const unit = unitExpr ? normalizeUnit(literalString(unitExpr)) : null;
      if (!unit || !startExpr || !endExpr) {
        return func(functionName, args);
      }
      const endDay = func("JULIANDAY", [endExpr]);
      const startDay = func("JULIANDAY", [startExpr]);
      const dayDiff = binaryExpr("-", endDay, startDay);
      switch (unit) {
        case "day":
          return castExpr(dayDiff, "INTEGER");
        case "week":
          return castExpr(
            binaryExpr(
              "-",
              binaryExpr("/", endDay, literal(7)),
              binaryExpr("/", startDay, literal(7))
            ),
            "INTEGER"
          );
        case "hour":
          return castExpr(
            binaryExpr(
              "-",
              binaryExpr("*", endDay, literal(24)),
              binaryExpr("*", startDay, literal(24))
            ),
            "INTEGER"
          );
        case "minute":
          return castExpr(
            binaryExpr(
              "-",
              binaryExpr("*", endDay, literal(1440)),
              binaryExpr("*", startDay, literal(1440))
            ),
            "INTEGER"
          );
        case "second":
          return castExpr(
            binaryExpr(
              "-",
              binaryExpr("*", endDay, literal(86400)),
              binaryExpr("*", startDay, literal(86400))
            ),
            "INTEGER"
          );
        case "month": {
          const yearDiff = binaryExpr(
            "-",
            castExpr(func("STRFTIME", [literal("%Y"), endExpr]), "INTEGER"),
            castExpr(func("STRFTIME", [literal("%Y"), startExpr]), "INTEGER")
          );
          const monthDiff = binaryExpr(
            "-",
            castExpr(func("STRFTIME", [literal("%m"), endExpr]), "INTEGER"),
            castExpr(func("STRFTIME", [literal("%m"), startExpr]), "INTEGER")
          );
          return binaryExpr("+", binaryExpr("*", yearDiff, literal(12)), monthDiff);
        }
        case "year":
          return binaryExpr(
            "-",
            castExpr(func("STRFTIME", [literal("%Y"), endExpr]), "INTEGER"),
            castExpr(func("STRFTIME", [literal("%Y"), startExpr]), "INTEGER")
          );
        default:
          return func(functionName, args);
      }
    }
    default:
      return null;
  }
}

function buildHiveAddMonths(
  valueExpr: ExprNode<any>,
  amountExpr: ExprNode<any>
): ExprNode<any> {
  return castExpr(
    func("CONCAT", [
      castExpr(
        func("ADD_MONTHS", [castExpr(valueExpr, "DATE"), amountExpr]),
        "STRING"
      ),
      literal(" "),
      func("DATE_FORMAT", [valueExpr, literal("HH:mm:ss")]),
    ]),
    "TIMESTAMP"
  );
}
