import type {
  BinaryOp,
  CaseWhenNode,
  DateLiteral,
  ExprNode,
  OrderItem,
  SqlDate,
  SqlFloat,
  SqlTimestamp,
  SqlInt,
  SqlNumber,
  SelectItem,
  TimestampLiteral,
  UnaryOp,
  Value,
} from "./types";
import {
  containsGroup,
  dedupeExprs,
  shouldAlias,
  unwrapGroupExpr,
} from "./expr_node_ops";

type NumericInput<T> = T extends SqlNumber ? T | number : T;
type ComparableInput = SqlNumber | SqlDate | SqlTimestamp;
export type ExprInput<T> = ExprRef<T> | NumericInput<T>;
export type CaseBuilder<T> = {
  when: (condition: ExprInput<boolean>, value: ExprInput<T>) => CaseBuilder<T>;
  else: (value: ExprInput<T>) => ExprRef<T>;
  end: () => ExprRef<T | null>;
};

export type WindowSpecInput = {
  partitionBy?: ExprRef<unknown> | ExprRef<unknown>[];
  orderBy?: OrderItem | OrderItem[];
};

/** Typed SQL expression reference with fluent helpers. */
export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}

  eq(value: ExprInput<T>): ExprRef<boolean> {
    return binaryExpr("=", this.node, toExprNode(value));
  }

  ne(value: ExprInput<T>): ExprRef<boolean> {
    return binaryExpr("!=", this.node, toExprNode(value));
  }

  gt<T extends ComparableInput>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<boolean> {
    return binaryExpr(">", this.node, toExprNode(value));
  }

  gte<T extends ComparableInput>(
    this: ExprRef<T>,
    value: ExprInput<T>
  ): ExprRef<boolean> {
    return binaryExpr(">=", this.node, toExprNode(value));
  }

  lt<T extends ComparableInput>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<boolean> {
    return binaryExpr("<", this.node, toExprNode(value));
  }

  lte<T extends ComparableInput>(
    this: ExprRef<T>,
    value: ExprInput<T>
  ): ExprRef<boolean> {
    return binaryExpr("<=", this.node, toExprNode(value));
  }

  like(this: ExprRef<string>, value: ExprInput<string>): ExprRef<boolean> {
    return binaryExpr("LIKE", this.node, toExprNode(value));
  }

  ["in"](values: readonly ExprInput<T>[]): ExprRef<boolean> {
    if (values.length === 0) {
      throw new Error("in requires at least one value");
    }
    return binaryExpr("IN", this.node, {
      kind: "list",
      items: values.map((value) => toExprNode(value)),
    });
  }

  and(this: ExprRef<boolean>, value: ExprInput<boolean>): ExprRef<boolean> {
    return binaryExpr("AND", this.node, toExprNode(value));
  }

  or(this: ExprRef<boolean>, value: ExprInput<boolean>): ExprRef<boolean> {
    return binaryExpr("OR", this.node, toExprNode(value));
  }

  not(this: ExprRef<boolean>): ExprRef<boolean> {
    return new ExprRef<boolean>({ kind: "unary", op: "NOT", expr: this.node });
  }

  add<T extends SqlNumber>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T> {
    return binaryExpr("+", this.node, toExprNode(value));
  }

  sub<T extends SqlNumber>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T> {
    return binaryExpr("-", this.node, toExprNode(value));
  }

  mul<T extends SqlNumber>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T> {
    return binaryExpr("*", this.node, toExprNode(value));
  }

  div<T extends SqlNumber>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T> {
    return binaryExpr("/", this.node, toExprNode(value));
  }

  mod<T extends SqlNumber>(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T> {
    return funcExpr("MOD", [this.node, toExprNode(value)]);
  }

  extract(this: ExprRef<unknown>, field: string): ExprRef<SqlFloat> {
    if (!field.trim()) {
      throw new Error("extract requires a field");
    }
    return new ExprRef<SqlFloat>({
      kind: "extract",
      field,
      source: this.node,
    });
  }

  dateTrunc(
    this: ExprRef<SqlDate | SqlTimestamp | string>,
    unit: ExprInput<string>
  ): ExprRef<SqlTimestamp> {
    return funcExpr("DATE_TRUNC", [toExprNode(unit), this.node]);
  }

  dateAdd(
    this: ExprRef<SqlDate | SqlTimestamp | string>,
    unit: ExprInput<string>,
    amount: ExprInput<SqlInt>
  ): ExprRef<SqlTimestamp> {
    return funcExpr("DATE_ADD", [toExprNode(unit), toExprNode(amount), this.node]);
  }

  dateDiff(
    this: ExprRef<SqlDate | SqlTimestamp | string>,
    unit: ExprInput<string>,
    other: ExprInput<SqlDate | SqlTimestamp | string>
  ): ExprRef<SqlInt> {
    return funcExpr("DATE_DIFF", [toExprNode(unit), this.node, toExprNode(other)]);
  }

  dateFormat(
    this: ExprRef<SqlDate | SqlTimestamp | string>,
    format: ExprInput<string>
  ): ExprRef<string> {
    return funcExpr("DATE_FORMAT", [this.node, toExprNode(format)]);
  }

  dateParse(this: ExprRef<string>, format: ExprInput<string>): ExprRef<SqlTimestamp> {
    return funcExpr("DATE_PARSE", [this.node, toExprNode(format)]);
  }

  toUnixTime(this: ExprRef<SqlDate | SqlTimestamp | string>): ExprRef<SqlFloat> {
    return funcExpr("TO_UNIXTIME", [this.node]);
  }

  fromUnixTime(this: ExprRef<SqlNumber>): ExprRef<SqlTimestamp> {
    return funcExpr("FROM_UNIXTIME", [this.node]);
  }

  year(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("year").cast<SqlInt>("INTEGER");
  }

  month(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("month").cast<SqlInt>("INTEGER");
  }

  day(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("day").cast<SqlInt>("INTEGER");
  }

  hour(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("hour").cast<SqlInt>("INTEGER");
  }

  minute(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("minute").cast<SqlInt>("INTEGER");
  }

  second(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return this.extract("second").cast<SqlInt>("INTEGER");
  }

  group(this: ExprRef<T>): ExprRef<T> {
    return new ExprRef<T>({ kind: "group", expr: this.node });
  }

  count(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return new ExprRef<SqlInt>({
      kind: "agg",
      name: "COUNT",
      arg: this.node,
      distinct: false,
    });
  }

  sum<T extends SqlNumber>(this: ExprRef<T>): ExprRef<T> {
    return new ExprRef<T>({
      kind: "agg",
      name: "SUM",
      arg: this.node,
      distinct: false,
    });
  }

  avg(this: ExprRef<SqlNumber>): ExprRef<SqlFloat> {
    return new ExprRef<SqlFloat>({
      kind: "agg",
      name: "AVG",
      arg: this.node,
      distinct: false,
    });
  }

  min(this: ExprRef<T>): ExprRef<T> {
    return new ExprRef<T>({
      kind: "agg",
      name: "MIN",
      arg: this.node,
      distinct: false,
    });
  }

  max(this: ExprRef<T>): ExprRef<T> {
    return new ExprRef<T>({
      kind: "agg",
      name: "MAX",
      arg: this.node,
      distinct: false,
    });
  }

  rank(this: ExprRef<unknown>): WindowBuilder<SqlInt> {
    return new WindowBuilder<SqlInt>("RANK", []);
  }

  denseRank(this: ExprRef<unknown>): WindowBuilder<SqlInt> {
    return new WindowBuilder<SqlInt>("DENSE_RANK", []);
  }

  rowNumber(this: ExprRef<unknown>): WindowBuilder<SqlInt> {
    return new WindowBuilder<SqlInt>("ROW_NUMBER", []);
  }

  lag(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T> {
    const args: ExprNode<unknown>[] = [this.node];
    if (offset !== undefined) args.push(toExprNode(offset));
    if (fallback !== undefined) args.push(toExprNode(fallback));
    return new WindowBuilder<T>("LAG", args);
  }

  lead(this: ExprRef<T>, offset?: ExprInput<SqlInt>, fallback?: ExprInput<T>): WindowBuilder<T> {
    const args: ExprNode<unknown>[] = [this.node];
    if (offset !== undefined) args.push(toExprNode(offset));
    if (fallback !== undefined) args.push(toExprNode(fallback));
    return new WindowBuilder<T>("LEAD", args);
  }

  percentRank(this: ExprRef<unknown>): WindowBuilder<SqlFloat> {
    return new WindowBuilder<SqlFloat>("PERCENT_RANK", []);
  }

  ntile(this: ExprRef<unknown>, buckets: ExprInput<SqlInt>): WindowBuilder<SqlInt> {
    return new WindowBuilder<SqlInt>("NTILE", [toExprNode(buckets)]);
  }

  ceil(this: ExprRef<SqlNumber>): ExprRef<SqlInt> {
    return funcExpr("CEIL", [this.node]);
  }

  floor(this: ExprRef<SqlNumber>): ExprRef<SqlInt> {
    return funcExpr("FLOOR", [this.node]);
  }

  abs<T extends SqlNumber>(this: ExprRef<T>): ExprRef<T> {
    return funcExpr("ABS", [this.node]);
  }

  sqrt(this: ExprRef<SqlNumber>): ExprRef<SqlFloat> {
    return funcExpr("SQRT", [this.node]);
  }

  pow(this: ExprRef<SqlNumber>, exponent: ExprInput<SqlNumber>): ExprRef<SqlFloat> {
    return funcExpr("POWER", [this.node, toExprNode(exponent)]);
  }

  greatest<T extends SqlNumber>(
    this: ExprRef<T>,
    ...values: ExprInput<T>[]
  ): ExprRef<T> {
    if (values.length === 0) {
      throw new Error("greatest requires at least one value");
    }
    return funcExpr("GREATEST", [
      this.node,
      ...values.map((value) => toExprNode(value)),
    ]);
  }

  least<T extends SqlNumber>(
    this: ExprRef<T>,
    ...values: ExprInput<T>[]
  ): ExprRef<T> {
    if (values.length === 0) {
      throw new Error("least requires at least one value");
    }
    return funcExpr("LEAST", [
      this.node,
      ...values.map((value) => toExprNode(value)),
    ]);
  }

  replace(
    this: ExprRef<string>,
    search: ExprInput<string>,
    replacement: ExprInput<string>
  ): ExprRef<string> {
    return funcExpr("REPLACE", [
      this.node,
      toExprNode(search),
      toExprNode(replacement),
    ]);
  }

  upper(this: ExprRef<string>): ExprRef<string> {
    return funcExpr("UPPER", [this.node]);
  }

  lower(this: ExprRef<string>): ExprRef<string> {
    return funcExpr("LOWER", [this.node]);
  }

  reverse(this: ExprRef<string>): ExprRef<string> {
    return funcExpr("REVERSE", [this.node]);
  }

  trim(this: ExprRef<string>): ExprRef<string> {
    return funcExpr("TRIM", [this.node]);
  }

  regexLike(this: ExprRef<string>, pattern: ExprInput<string>): ExprRef<boolean> {
    return funcExpr("REGEXP_LIKE", [this.node, toExprNode(pattern)]);
  }

  regexReplace(
    this: ExprRef<string>,
    pattern: ExprInput<string>,
    replacement: ExprInput<string>,
    flags?: ExprInput<string>
  ): ExprRef<string> {
    const args = [this.node, toExprNode(pattern), toExprNode(replacement)];
    if (flags !== undefined) args.push(toExprNode(flags));
    return funcExpr("REGEXP_REPLACE", args);
  }

  regexExtract(
    this: ExprRef<string>,
    pattern: ExprInput<string>,
    groupIndex?: ExprInput<SqlInt>
  ): ExprRef<string> {
    const args = [this.node, toExprNode(pattern)];
    if (groupIndex !== undefined) args.push(toExprNode(groupIndex));
    return funcExpr("REGEXP_EXTRACT", args);
  }

  substring(
    this: ExprRef<string>,
    start: ExprInput<SqlInt>,
    length?: ExprInput<SqlInt>
  ): ExprRef<string> {
    const args = [this.node, toExprNode(start)];
    if (length !== undefined) args.push(toExprNode(length));
    return funcExpr("SUBSTRING", args);
  }

  position(this: ExprRef<string>, needle: ExprInput<string>): ExprRef<SqlInt> {
    return funcExpr("POSITION", [toExprNode(needle), this.node]);
  }

  overlay(
    this: ExprRef<string>,
    placing: ExprInput<string>,
    start: ExprInput<SqlInt>,
    length?: ExprInput<SqlInt>
  ): ExprRef<string> {
    const args = [this.node, toExprNode(placing), toExprNode(start)];
    if (length !== undefined) args.push(toExprNode(length));
    return funcExpr("OVERLAY", args);
  }

  charLength(this: ExprRef<string>): ExprRef<SqlInt> {
    return funcExpr("CHAR_LENGTH", [this.node]);
  }

  characterLength(this: ExprRef<string>): ExprRef<SqlInt> {
    return funcExpr("CHARACTER_LENGTH", [this.node]);
  }

  octetLength(this: ExprRef<string>): ExprRef<SqlInt> {
    return funcExpr("OCTET_LENGTH", [this.node]);
  }

  bitLength(this: ExprRef<string>): ExprRef<SqlInt> {
    return funcExpr("BIT_LENGTH", [this.node]);
  }

  left(this: ExprRef<string>, length: ExprInput<SqlInt>): ExprRef<string> {
    return funcExpr("LEFT", [this.node, toExprNode(length)]);
  }

  right(this: ExprRef<string>, length: ExprInput<SqlInt>): ExprRef<string> {
    return funcExpr("RIGHT", [this.node, toExprNode(length)]);
  }

  lpad(
    this: ExprRef<string>,
    length: ExprInput<SqlInt>,
    padding: ExprInput<string> = " "
  ): ExprRef<string> {
    return funcExpr("LPAD", [this.node, toExprNode(length), toExprNode(padding)]);
  }

  rpad(
    this: ExprRef<string>,
    length: ExprInput<SqlInt>,
    padding: ExprInput<string> = " "
  ): ExprRef<string> {
    return funcExpr("RPAD", [this.node, toExprNode(length), toExprNode(padding)]);
  }

  concat(this: ExprRef<string>, ...parts: ExprInput<unknown>[]): ExprRef<string> {
    if (parts.length === 0) return this;
    return funcExpr("CONCAT", [this.node, ...parts.map((part) => toExprNode(part))]);
  }

  arrayLength(this: ExprRef<unknown>): ExprRef<SqlInt> {
    return funcExpr("ARRAY_LENGTH", [this.node]);
  }

  arrayContains(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<boolean> {
    return funcExpr("ARRAY_CONTAINS", [this.node, toExprNode(value)]);
  }

  arrayPosition(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<SqlInt> {
    return funcExpr("ARRAY_POSITION", [this.node, toExprNode(value)]);
  }

  arraySlice(
    this: ExprRef<unknown>,
    start: ExprInput<SqlInt>,
    length?: ExprInput<SqlInt>
  ): ExprRef<unknown> {
    const args = [this.node, toExprNode(start)];
    if (length !== undefined) args.push(toExprNode(length));
    return funcExpr("ARRAY_SLICE", args);
  }

  arrayJoin(this: ExprRef<unknown>, separator: ExprInput<string>): ExprRef<string> {
    return funcExpr("ARRAY_JOIN", [this.node, toExprNode(separator)]);
  }

  arrayAppend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown> {
    return funcExpr("ARRAY_APPEND", [this.node, toExprNode(value)]);
  }

  arrayPrepend(this: ExprRef<unknown>, value: ExprInput<unknown>): ExprRef<unknown> {
    return funcExpr("ARRAY_PREPEND", [this.node, toExprNode(value)]);
  }

  arrayConcat(this: ExprRef<unknown>, ...values: ExprInput<unknown>[]): ExprRef<unknown> {
    if (values.length === 0) return this;
    return funcExpr("ARRAY_CONCAT", [
      this.node,
      ...values.map((value) => toExprNode(value)),
    ]);
  }

  arrayDistinct(this: ExprRef<unknown>): ExprRef<unknown> {
    return funcExpr("ARRAY_DISTINCT", [this.node]);
  }

  coalesce(this: ExprRef<T>, ...values: ExprInput<T>[]): ExprRef<T> {
    if (values.length === 0) {
      throw new Error("coalesce requires at least one fallback value");
    }
    return funcExpr("COALESCE", [
      this.node,
      ...values.map((value) => toExprNode(value)),
    ]);
  }

  nullIf(this: ExprRef<T>, value: ExprInput<T>): ExprRef<T | null> {
    return funcExpr("NULLIF", [this.node, toExprNode(value)]);
  }

  isNull(): ExprRef<boolean> {
    return binaryExpr("IS", this.node, toExprNode(null));
  }

  isNotNull(): ExprRef<boolean> {
    return binaryExpr("IS NOT", this.node, toExprNode(null));
  }

  asc(): OrderItem {
    return { expr: this.node, direction: "ASC" };
  }

  desc(): OrderItem {
    return { expr: this.node, direction: "DESC" };
  }

  sumOver<T extends SqlNumber>(
    this: ExprRef<T>,
    spec: WindowSpecInput = {}
  ): ExprRef<T> {
    return new WindowBuilder<T>("SUM", [this.node]).over(spec);
  }

  cast<TTarget = unknown>(target: string): ExprRef<TTarget> {
    if (!target.trim()) {
      throw new Error("cast requires a target type");
    }
    return new ExprRef<TTarget>({
      kind: "cast",
      expr: this.node,
      target,
    });
  }

  toInt(this: ExprRef<SqlNumber>): ExprRef<SqlInt> {
    return this.cast<SqlInt>("INTEGER");
  }

  toFloat(this: ExprRef<SqlNumber>): ExprRef<SqlFloat> {
    return this.cast<SqlFloat>("FLOAT");
  }

  toDate(this: ExprRef<SqlTimestamp>): ExprRef<SqlDate> {
    return this.cast<SqlDate>("DATE");
  }

  round(this: ExprRef<SqlNumber>, scale?: ExprInput<SqlInt>): ExprRef<SqlNumber> {
    const args = scale === undefined ? [this.node] : [this.node, toExprNode(scale)];
    return funcExpr("ROUND", args);
  }
}

export class ColumnRef<T, Name extends string> extends ExprRef<T> {
  readonly table: string | null;
  readonly name: Name;

  constructor(table: string | null, name: Name) {
    super({ kind: "column", table, name });
    this.table = table;
    this.name = name;
  }
}

export type ColumnRefs<T extends Record<string, unknown>> = {
  [K in keyof T & string]: ColumnRef<T[K], K>;
};

export type SelectValue = ExprRef<unknown> | Value;
export type SelectShape = Record<string, SelectValue>;
export type SelectResult<S extends SelectShape> = {
  [K in keyof S]: S[K] extends ExprRef<infer T> ? T : S[K];
};

/** Create a typed SQL literal expression. */
export function lit<T extends Value>(value: T): ExprRef<T> {
  return new ExprRef<T>({ kind: "literal", value });
}

/** Call a SQL function with arbitrary arguments. */
export function fn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): ExprRef<T> {
  if (!name.trim()) {
    throw new Error("fn requires a function name");
  }
  return funcExpr(name, args.map((arg) => toExprNode(arg)));
}

/** Call a SQL window function (use `.over(...)` on the result). */
export function windowFn<T = unknown>(
  name: string,
  ...args: ExprInput<unknown>[]
): WindowBuilder<T> {
  if (!name.trim()) {
    throw new Error("windowFn requires a function name");
  }
  return new WindowBuilder<T>(name, args.map((arg) => toExprNode(arg)));
}

/** SQL standard CURRENT_DATE expression. */
export function currentDate(): ExprRef<SqlDate> {
  return funcExpr("CURRENT_DATE", []);
}

/** SQL standard CURRENT_TIMESTAMP expression. */
export function currentTimestamp(): ExprRef<SqlTimestamp> {
  return funcExpr("CURRENT_TIMESTAMP", []);
}

/** SQL DATE literal expression. */
export function dateLiteral(value: string): ExprRef<SqlDate> {
  return new ExprRef<SqlDate>({
    kind: "literal",
    value: { kind: "date_literal", value } as DateLiteral,
  });
}

/** SQL TIMESTAMP literal expression. */
export function timestampLiteral(value: string): ExprRef<SqlTimestamp> {
  return new ExprRef<SqlTimestamp>({
    kind: "literal",
    value: { kind: "timestamp_literal", value } as TimestampLiteral,
  });
}

export function upper(value: ExprInput<string>): ExprRef<string> {
  return funcExpr("UPPER", [toExprNode(value)]);
}

export function lower(value: ExprInput<string>): ExprRef<string> {
  return funcExpr("LOWER", [toExprNode(value)]);
}

export function trim(value: ExprInput<string>): ExprRef<string> {
  return funcExpr("TRIM", [toExprNode(value)]);
}

export function substring(
  value: ExprInput<string>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<string> {
  const args = [toExprNode(value), toExprNode(start)];
  if (length !== undefined) args.push(toExprNode(length));
  return funcExpr("SUBSTRING", args);
}

export function position(
  needle: ExprInput<string>,
  haystack: ExprInput<string>
): ExprRef<SqlInt> {
  return funcExpr("POSITION", [toExprNode(needle), toExprNode(haystack)]);
}

export function overlay(
  value: ExprInput<string>,
  placing: ExprInput<string>,
  start: ExprInput<SqlInt>,
  length?: ExprInput<SqlInt>
): ExprRef<string> {
  const args = [toExprNode(value), toExprNode(placing), toExprNode(start)];
  if (length !== undefined) args.push(toExprNode(length));
  return funcExpr("OVERLAY", args);
}

export function charLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return funcExpr("CHAR_LENGTH", [toExprNode(value)]);
}

export function characterLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return funcExpr("CHARACTER_LENGTH", [toExprNode(value)]);
}

export function octetLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return funcExpr("OCTET_LENGTH", [toExprNode(value)]);
}

export function bitLength(value: ExprInput<string>): ExprRef<SqlInt> {
  return funcExpr("BIT_LENGTH", [toExprNode(value)]);
}
/** Start a CASE expression builder. */
export function when<T>(
  condition: ExprInput<boolean>,
  value: ExprInput<T>
): CaseBuilder<T> {
  return new CaseBuilderImpl<T>([
    { when: toExprNode(condition), then: toExprNode(value) },
  ]);
}

export type ExprShape<T extends Record<string, ExprRef<unknown>>> = {
  map: (mapper: (value: T[keyof T]) => ExprRef<unknown>) => {
    [K in keyof T]: ExprRef<unknown>;
  };
  group: () => { [K in keyof T]: ExprRef<unknown> };
};

/** Wrap a shape to apply methods to each expression value. */
export function shape<T extends Record<string, ExprRef<unknown>>>(value: T): ExprShape<T> {
  return {
    map(mapper) {
      const result: Record<string, ExprRef<unknown>> = {};
      for (const key of Object.keys(value) as Array<keyof T>) {
        result[key as string] = mapper(value[key]);
      }
      return result as { [K in keyof T]: ExprRef<unknown> };
    },
    group() {
      const result: Record<string, ExprRef<unknown>> = {};
      for (const key of Object.keys(value) as Array<keyof T>) {
        const item = value[key];
        if (!item) continue;
        result[key as string] = item.group();
      }
      return result as { [K in keyof T]: ExprRef<unknown> };
    },
  };
}

/** Template string helper that concatenates parts with SQL CONCAT. */
export function f(
  strings: TemplateStringsArray,
  ...exprs: ExprInput<unknown>[]
): ExprRef<string> {
  const parts: ExprInput<unknown>[] = [];
  for (let i = 0; i < strings.length; i += 1) {
    const literal = strings[i] ?? "";
    if (literal.length > 0) parts.push(literal);
    const expr = exprs[i];
    if (expr !== undefined) parts.push(expr);
  }
  if (parts.length === 0) return lit("");
  return funcExpr("CONCAT", parts.map((part) => toExprNode(part)));
}

export function createColumnRefs<TColumns extends Record<string, unknown>>(
  tableName: string | null,
  columnNames?: readonly string[] | null
): ColumnRefs<TColumns> {
  const cache = new Map<string, ColumnRef<unknown, string>>();
  const columns = columnNames ? [...columnNames] : [];
  const getColumn = (name: string) => {
    const existing = cache.get(name);
    if (existing) return existing;
    const next = new ColumnRef<unknown, string>(tableName, name);
    cache.set(name, next);
    return next;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return getColumn(prop);
      },
      ownKeys() {
        return columns;
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!columns.includes(prop)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: getColumn(prop),
        };
      },
    }
  ) as ColumnRefs<TColumns>;
}

export function mergeColumnRefs<
  TLeft extends Record<string, unknown>,
  TRight extends Record<string, unknown>
>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>,
  leftKeys: readonly string[] | null,
  rightKeys: readonly string[] | null
): ColumnRefs<TLeft & TRight> {
  const mergedKeys = mergeColumnNames(leftKeys, rightKeys);
  const getColumn = (prop: string) => {
    const leftHas = leftKeys ? leftKeys.includes(prop) : false;
    const rightHas = rightKeys ? rightKeys.includes(prop) : false;
    const leftValue = Reflect.get(left, prop);
    const rightValue = Reflect.get(right, prop);
    const leftRef = leftValue instanceof ExprRef ? leftValue : undefined;
    const rightRef = rightValue instanceof ExprRef ? rightValue : undefined;
    if (rightHas && !leftHas) return rightRef;
    return leftRef ?? rightRef;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return getColumn(prop);
      },
      ownKeys() {
        return mergedKeys ?? [];
      },
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (!mergedKeys || !mergedKeys.includes(prop)) return undefined;
        return {
          enumerable: true,
          configurable: true,
          writable: false,
          value: getColumn(prop),
        };
      },
    }
  ) as ColumnRefs<TLeft & TRight>;
}

export function mergeColumnNames(
  left: readonly string[] | null,
  right: readonly string[] | null
): readonly string[] | null {
  if (!left && !right) return null;
  if (!left) return right ? [...right] : null;
  if (!right) return [...left];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const key of left) {
    if (!seen.has(key)) {
      merged.push(key);
      seen.add(key);
    }
  }
  for (const key of right) {
    if (!seen.has(key)) {
      merged.push(key);
      seen.add(key);
    }
  }
  return merged;
}

export function selectAllItems<TColumns extends Record<string, unknown>>(
  columns: ColumnRefs<TColumns>,
  columnNames: readonly string[] | null
): SelectItem[] {
  if (!columnNames) {
    throw new Error("Cannot expand select-all without a schema");
  }
  return columnNames.map((name) => {
    const value = Reflect.get(columns, name);
    if (!(value instanceof ExprRef)) {
      throw new Error(`Unknown column ref: ${name}`);
    }
    const ref = value;
    const expr = toExprNode(ref);
    return { expr, as: shouldAlias(expr, name) ? name : null };
  });
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<unknown> {
  if (value instanceof ExprRef) return value.node;
  if (value === undefined) {
    throw new Error("Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return { kind: "literal", value: value as Value };
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value };
  }
  throw new Error(`Unsupported literal value: ${String(value)}`);
}

function isTemporalLiteral(value: unknown): value is DateLiteral | TimestampLiteral {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; value?: unknown };
  if (candidate.value !== undefined && typeof candidate.value !== "string") return false;
  return candidate.kind === "date_literal" || candidate.kind === "timestamp_literal";
}
export { containsGroup, unwrapGroupExpr, dedupeExprs, shouldAlias };

export function toExprNodeList(
  input?: ExprRef<unknown> | ExprRef<unknown>[]
): ExprNode<unknown>[] | null {
  if (!input) return null;
  const items = Array.isArray(input) ? input : [input];
  return items.map((item) => toExprNode(item));
}

export function toOrderItems(input?: OrderItem | OrderItem[]): OrderItem[] | null {
  if (!input) return null;
  return Array.isArray(input) ? input : [input];
}

function buildCaseExpr<T>(
  whens: CaseWhenNode[],
  elseExpr: ExprNode<unknown> | null
): ExprRef<T | null> {
  return new ExprRef<T | null>({
    kind: "case",
    whens,
    elseExpr,
  });
}

class CaseBuilderImpl<T> implements CaseBuilder<T> {
  constructor(private readonly whens: CaseWhenNode[]) {}

  when(condition: ExprInput<boolean>, value: ExprInput<T>): CaseBuilder<T> {
    return new CaseBuilderImpl<T>([
      ...this.whens,
      { when: toExprNode(condition), then: toExprNode(value) },
    ]);
  }

  else(value: ExprInput<T>): ExprRef<T> {
    return buildCaseExpr<T>(this.whens, toExprNode(value)) as ExprRef<T>;
  }

  end(): ExprRef<T | null> {
    return buildCaseExpr<T>(this.whens, null);
  }
}

class WindowBuilder<T> {
  constructor(private readonly name: string, private readonly args: ExprNode<unknown>[]) {}

  over(spec: WindowSpecInput = {}): ExprRef<T> {
    const partitionBy = toExprNodeList(spec.partitionBy);
    const orderBy = toOrderItems(spec.orderBy);
    return new ExprRef<T>({
      kind: "window",
      name: this.name,
      args: this.args,
      partitionBy,
      orderBy,
    });
  }
}

function binaryExpr(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown> {
  return new ExprRef({ kind: "binary", op, left, right });
}

function funcExpr<T>(name: string, args: ExprNode<unknown>[]): ExprRef<T> {
  return new ExprRef<T>({ kind: "func", name, args });
}
