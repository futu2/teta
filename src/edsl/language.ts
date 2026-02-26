import type {
  DialectLanguageConfig,
  DialectLanguageFallback,
  ExprNode,
  QueryDialect,
} from "./types";

export const LANGUAGE_SPEC = {
  math: [
    "+",
    "-",
    "*",
    "/",
    "MOD",
    "ABS",
    "CEIL",
    "FLOOR",
    "SQRT",
    "ROUND",
    "POWER",
    "GREATEST",
    "LEAST",
  ],
  string: [
    "CONCAT",
    "UPPER",
    "LOWER",
    "TRIM",
    "SUBSTRING",
    "POSITION",
    "OVERLAY",
    "CHAR_LENGTH",
    "CHARACTER_LENGTH",
    "OCTET_LENGTH",
    "BIT_LENGTH",
    "REPLACE",
    "REVERSE",
    "LEFT",
    "RIGHT",
    "LPAD",
    "RPAD",
    "REGEXP_LIKE",
    "REGEXP_REPLACE",
    "REGEXP_EXTRACT",
  ],
  logical: [
    "=",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "AND",
    "OR",
    "NOT",
    "LIKE",
    "IN",
  ],
  dateTime: [
    "CURRENT_DATE",
    "CURRENT_TIMESTAMP",
    "EXTRACT",
    "DATE_TRUNC",
    "DATE_ADD",
    "DATE_DIFF",
    "DATE_PARSE",
    "DATE_FORMAT",
    "TO_UNIXTIME",
    "FROM_UNIXTIME",
  ],
  conversionAndNull: [
    "CAST",
    "TRY_CAST",
    "COALESCE",
    "NULLIF",
    "IS NULL",
    "IS NOT NULL",
  ],
  array: [
    "ARRAY_LENGTH",
    "ARRAY_CONTAINS",
    "ARRAY_POSITION",
    "ARRAY_SLICE",
    "ARRAY_JOIN",
    "ARRAY_APPEND",
    "ARRAY_PREPEND",
    "ARRAY_CONCAT",
    "ARRAY_DISTINCT",
  ],
  windowAndAgg: [
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "RANK",
    "DENSE_RANK",
    "ROW_NUMBER",
    "LAG",
    "LEAD",
    "PERCENT_RANK",
    "NTILE",
  ],
  queryFeatures: ["LATERAL_JOIN", "RECURSIVE_CTE"],
} as const;

export type LanguageCategory = keyof typeof LANGUAGE_SPEC;

export function getLanguageSpec(): typeof LANGUAGE_SPEC {
  return LANGUAGE_SPEC;
}

const IDENTITY_LANGUAGE: Required<DialectLanguageConfig> = {
  functions: {},
  fallbacks: {},
  unsupported: [],
};

const DIALECT_LANGUAGE: Record<string, DialectLanguageConfig> = {
  sqlite: {
    functions: {
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      OCTET_LENGTH: "LENGTH",
      CEIL: "CEILING",
    },
    fallbacks: {
      BIT_LENGTH: "bit_length_via_length_x8",
      DATE_FORMAT: "date_format_via_strftime",
      DATE_PARSE: "date_parse_via_datetime",
      DATE_TRUNC: "date_trunc_via_strftime",
      DATE_ADD: "date_add_via_datetime",
      DATE_DIFF: "date_diff_via_julianday",
      TO_UNIXTIME: "to_unixtime_via_strftime_s",
      FROM_UNIXTIME: "from_unixtime_via_datetime",
      ARRAY_LENGTH: "array_length_via_json_array_length",
      ARRAY_CONTAINS: "array_contains_via_json_instr",
      ARRAY_POSITION: "array_position_via_json_instr",
      ARRAY_JOIN: "array_join_via_json_string",
      ARRAY_APPEND: "array_append_via_json_insert_end",
      REGEXP_LIKE: "regex_like_via_regexp_function",
    },
  },
  postgresql: {
    functions: {
      CHARACTER_LENGTH: "CHAR_LENGTH",
      DATE_FORMAT: "TO_CHAR",
      DATE_PARSE: "TO_TIMESTAMP",
      FROM_UNIXTIME: "TO_TIMESTAMP",
      ARRAY_JOIN: "ARRAY_TO_STRING",
      REGEXP_EXTRACT: "REGEXP_SUBSTR",
    },
    fallbacks: {
      DATE_ADD: "date_add_via_epoch_timestamp",
      DATE_DIFF: "date_diff_via_extract_epoch",
      TO_UNIXTIME: "to_unixtime_via_extract_epoch",
      ARRAY_LENGTH: "array_length_dim1",
      ARRAY_CONTAINS: "array_contains_via_array_position",
      REGEXP_LIKE: "regex_like_via_regexp_match",
    },
  },
  duckdb: {},
  hetu: {
    functions: {
      CHARACTER_LENGTH: "LENGTH",
      CHAR_LENGTH: "LENGTH",
      ARRAY_LENGTH: "CARDINALITY",
      ARRAY_SLICE: "SLICE",
      ARRAY_CONCAT: "CONCAT",
      REGEXP_EXTRACT: "REGEXP_EXTRACT",
    },
  },
};

export function applyDialectLanguage(expr: ExprNode<any>, dialect: QueryDialect): ExprNode<any> {
  const normalized = rewriteExpr(expr, dialect.language);
  validateExpr(normalized, dialect.language);
  return normalized;
}

export function resolveDialectLanguage(
  dialectName: string,
  override?: DialectLanguageConfig
): Required<DialectLanguageConfig> {
  const normalizedName = dialectName.toLowerCase();
  const base = DIALECT_LANGUAGE[normalizedName] ?? IDENTITY_LANGUAGE;
  const merged: Required<DialectLanguageConfig> = {
    functions: { ...base.functions, ...(override?.functions ?? {}) },
    fallbacks: { ...base.fallbacks, ...(override?.fallbacks ?? {}) },
    unsupported: [...(base.unsupported ?? []), ...(override?.unsupported ?? [])],
  };
  return merged;
}

function rewriteExpr(
  expr: ExprNode<any>,
  language: Required<DialectLanguageConfig>
): ExprNode<any> {
  switch (expr.kind) {
    case "binary":
      return {
        ...expr,
        left: rewriteExpr(expr.left, language),
        right: rewriteExpr(expr.right, language),
      };
    case "unary":
      return { ...expr, expr: rewriteExpr(expr.expr, language) };
    case "agg":
      return { ...expr, arg: rewriteExpr(expr.arg, language) };
    case "group":
      return { ...expr, expr: rewriteExpr(expr.expr, language) };
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteExpr(item, language)),
      };
    case "extract":
      return {
        ...expr,
        source: rewriteExpr(expr.source, language),
      };
    case "cast":
      return {
        ...expr,
        expr: rewriteExpr(expr.expr, language),
      };
    case "window":
      return {
        ...expr,
        name: resolveFunctionName(expr.name, language),
        args: expr.args.map((arg) => rewriteExpr(arg, language)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => rewriteExpr(arg, language))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: rewriteExpr(item.expr, language),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: rewriteExpr(item.when, language),
          then: rewriteExpr(item.then, language),
        })),
        elseExpr: expr.elseExpr ? rewriteExpr(expr.elseExpr, language) : null,
      };
    case "func": {
      const mappedName = resolveFunctionName(expr.name, language);
      const rewrittenArgs = expr.args.map((arg) => rewriteExpr(arg, language));
      return applyFallback(mappedName, rewrittenArgs, language);
    }
    default:
      return expr;
  }
}

function applyFallback(
  functionName: string,
  args: ExprNode<any>[],
  language: Required<DialectLanguageConfig>
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

function rewriteFallback(
  functionName: string,
  args: ExprNode<any>[],
  fallback: DialectLanguageFallback
): ExprNode<any> {
  switch (fallback) {
    case "bit_length_via_length_x8": {
      const value = args[0];
      if (!value) {
        return func(functionName, args);
      }
      return binaryExpr("*", func("LENGTH", [value]), literal(8));
    }
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
    case "array_contains_via_array_position": {
      const arrayExpr = args[0];
      const valueExpr = args[1];
      if (!arrayExpr || !valueExpr) {
        return func(functionName, args);
      }
      return binaryExpr(
        "IS NOT",
        func("ARRAY_POSITION", [arrayExpr, valueExpr]),
        literal(null)
      );
    }
    case "array_contains_via_json_instr": {
      const arrayExpr = args[0];
      const valueExpr = args[1];
      if (!arrayExpr || !valueExpr) {
        return func(functionName, args);
      }
      const jsonArray = func("JSON_EXTRACT", [arrayExpr, literal("$")]);
      const quotedValue = func("JSON_QUOTE", [valueExpr]);
      return binaryExpr(
        ">",
        func("INSTR", [jsonArray, quotedValue]),
        literal(0)
      );
    }
    case "array_position_via_json_instr": {
      const arrayExpr = args[0];
      const valueExpr = args[1];
      if (!arrayExpr || !valueExpr) {
        return func(functionName, args);
      }
      const jsonArray = func("JSON_EXTRACT", [arrayExpr, literal("$")]);
      const quotedValue = func("JSON_QUOTE", [valueExpr]);
      return func("NULLIF", [func("INSTR", [jsonArray, quotedValue]), literal(0)]);
    }
    case "array_join_via_json_string": {
      const arrayExpr = args[0];
      if (!arrayExpr) {
        return func(functionName, args);
      }
      const separator = args[1] ?? literal(",");
      const jsonText = func("JSON_EXTRACT", [arrayExpr, literal("$")]);
      const noOpen = func("REPLACE", [jsonText, literal("["), literal("")]);
      const noClose = func("REPLACE", [noOpen, literal("]"), literal("")]);
      const noQuotes = func("REPLACE", [noClose, literal('"'), literal("")]);
      return func("REPLACE", [noQuotes, literal(","), separator]);
    }
    case "array_append_via_json_insert_end": {
      const arrayExpr = args[0];
      const valueExpr = args[1];
      if (!arrayExpr || !valueExpr) {
        return func(functionName, args);
      }
      return func("JSON_INSERT", [arrayExpr, literal("$[#]"), valueExpr]);
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
    case "date_format_via_strftime": {
      const valueExpr = args[0];
      const formatExpr = args[1];
      if (!valueExpr || !formatExpr) {
        return func(functionName, args);
      }
      return func("STRFTIME", [formatExpr, valueExpr]);
    }
    case "date_parse_via_datetime": {
      const valueExpr = args[0];
      if (!valueExpr) {
        return func(functionName, args);
      }
      return func("DATETIME", [valueExpr]);
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
      return func(functionName, args);
  }
}

function validateExpr(
  expr: ExprNode<any>,
  language: Required<DialectLanguageConfig>
): void {
  switch (expr.kind) {
    case "binary":
      validateExpr(expr.left, language);
      validateExpr(expr.right, language);
      return;
    case "unary":
      validateExpr(expr.expr, language);
      return;
    case "agg":
      validateExpr(expr.arg, language);
      return;
    case "group":
      validateExpr(expr.expr, language);
      return;
    case "extract":
      validateExpr(expr.source, language);
      return;
    case "cast":
      validateExpr(expr.expr, language);
      return;
    case "list":
      expr.items.forEach((item) => validateExpr(item, language));
      return;
    case "window":
      expr.args.forEach((item) => validateExpr(item, language));
      expr.partitionBy?.forEach((item) => validateExpr(item, language));
      expr.orderBy?.forEach((item) => validateExpr(item.expr, language));
      return;
    case "case":
      expr.whens.forEach((item) => {
        validateExpr(item.when, language);
        validateExpr(item.then, language);
      });
      if (expr.elseExpr) validateExpr(expr.elseExpr, language);
      return;
    case "func": {
      const normalized = expr.name.toUpperCase();
      if (language.unsupported.includes(normalized)) {
        throw new Error(`Function ${expr.name} is not supported by this dialect`);
      }
      expr.args.forEach((item) => validateExpr(item, language));
      return;
    }
    default:
      return;
  }
}

function resolveFunctionName(
  name: string,
  language: Required<DialectLanguageConfig>
): string {
  const normalized = name.toUpperCase();
  return language.functions[normalized] ?? name;
}

function func(name: string, args: ExprNode<any>[]): ExprNode<any> {
  return {
    kind: "func",
    name,
    args,
  };
}

function binaryExpr(
  op: "+" | "-" | "*" | "/" | ">" | "IS NOT",
  left: ExprNode<any>,
  right: ExprNode<any>
): ExprNode<any> {
  return {
    kind: "binary",
    op,
    left,
    right,
  };
}

function castExpr(expr: ExprNode<any>, target: string): ExprNode<any> {
  return {
    kind: "cast",
    expr,
    target,
  };
}

function literal(value: string | number | boolean | null): ExprNode<any> {
  return {
    kind: "literal",
    value,
  };
}

function literalString(expr: ExprNode<any>): string | null {
  if (expr.kind !== "literal") return null;
  return typeof expr.value === "string" ? expr.value : null;
}

function extractFieldExpr(field: string, source: ExprNode<any>): ExprNode<any> {
  return {
    kind: "extract",
    field,
    source,
  };
}

function extractFieldAsInt(field: string, source: ExprNode<any>): ExprNode<any> {
  return castExpr(extractFieldExpr(field, source), "INTEGER");
}

function normalizeUnit(value: string | null): string | null {
  if (!value) return null;
  const unit = value.trim().toLowerCase();
  if (!unit) return null;
  switch (unit) {
    case "years":
    case "year":
    case "yy":
    case "yyyy":
      return "year";
    case "quarters":
    case "quarter":
    case "qq":
      return "quarter";
    case "months":
    case "month":
    case "mm":
      return "month";
    case "weeks":
    case "week":
    case "wk":
      return "week";
    case "days":
    case "day":
    case "dd":
      return "day";
    case "hours":
    case "hour":
    case "hh":
      return "hour";
    case "minutes":
    case "minute":
    case "mi":
      return "minute";
    case "seconds":
    case "second":
    case "ss":
      return "second";
    default:
      return unit;
  }
}

const DATE_TRUNC_FORMATS: Record<string, string> = {
  year: "%Y-01-01 00:00:00",
  quarter: "%Y-%m-01 00:00:00",
  month: "%Y-%m-01 00:00:00",
  day: "%Y-%m-%d 00:00:00",
  hour: "%Y-%m-%d %H:00:00",
  minute: "%Y-%m-%d %H:%M:00",
  second: "%Y-%m-%d %H:%M:%S",
};

const DATE_ADD_TEMPLATES: Record<string, { unit: string; factor: number }> = {
  year: { unit: "year", factor: 1 },
  quarter: { unit: "month", factor: 3 },
  month: { unit: "month", factor: 1 },
  week: { unit: "day", factor: 7 },
  day: { unit: "day", factor: 1 },
  hour: { unit: "hour", factor: 1 },
  minute: { unit: "minute", factor: 1 },
  second: { unit: "second", factor: 1 },
};

const DATE_ADD_EPOCH_FACTORS: Record<string, number> = {
  week: 60 * 60 * 24 * 7,
  day: 60 * 60 * 24,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};

const DATE_DIFF_EPOCH_FACTORS: Record<string, number> = {
  week: 60 * 60 * 24 * 7,
  day: 60 * 60 * 24,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};
