import type { AST, Option, With } from "node-sql-parser";
import type {
  Dialect,
  ExprNode,
  OrderItem,
  Source,
  SourceRef,
  SqlOptions,
  SqlFormat,
  Stage,
  Value,
} from "./types";
import type { ColumnRefs } from "./expr";
import { selectAllItems } from "./expr";

export function compilePipeline(
  source: Source,
  stages: Stage[],
  columns: ColumnRefs<Record<string, any>>,
  columnNames: readonly string[] | null
): AST {
  if (stages.length === 0) {
    return buildSelectAst({
      from: [
        sourceToFrom({
          kind: "table",
          name: source.table,
          schema: source.schema,
          as: source.as,
        }),
      ],
      columns: selectAllItems(columns, columnNames).map((item) => ({
        expr: exprToAst(item.expr),
        as: item.as,
      })),
      where: null,
      groupby: null,
      orderby: null,
      limit: null,
    });
  }

  const ctes: With[] = [];
  let current: SourceRef = {
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  };

  for (let i = 0; i < stages.length - 1; i += 1) {
    const stage = hoistJoinSubquery(stages[i], ctes);
    const stageAst = stageToSelect(stage, current);
    const name = `cte_${i}`;
    ctes.push({
      name: { value: name },
      stmt: {
        ast: stageAst as any,
        tableList: [],
        columnList: [],
      },
    });
    current = { kind: "cte", name };
  }

  const finalStage = hoistJoinSubquery(stages[stages.length - 1], ctes);
  const finalAst = stageToSelect(finalStage, current);
  finalAst.with = ctes.length ? ctes : null;
  return finalAst as AST;
}

function stageToSelect(stage: Stage, source: SourceRef): AST {
  const baseFrom = sourceToFrom(source);
  switch (stage.kind) {
    case "select":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.items.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr)),
          as: item.as,
        })),
        where: null,
        groupby: stage.groupBy
          ? {
              columns: stage.groupBy.map((expr) =>
                exprToAst(stripTableRefs(expr))
              ),
              modifiers: [],
            }
          : null,
        orderby: null,
        limit: null,
      });
    case "filter":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr)),
          as: item.as,
        })),
        where: exprToAst(stripTableRefs(stage.predicate)),
        groupby: null,
        orderby: null,
        limit: null,
      });
    case "orderBy":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: stage.items.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr)),
          type: item.direction,
        })),
        limit: null,
      });
    case "limit":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: null,
        limit: {
          seperator: "",
          value: [{ type: "number", value: stage.count }],
        },
      });
    case "join": {
      const join = `${stage.joinType} JOIN`;
      const keepTables = stage.as ? new Set([stage.as]) : undefined;
      return buildSelectAst({
        from: [
          baseFrom,
          stage.source.kind === "table"
            ? {
                db: null,
                schema: stage.source.schema,
                table: stage.source.table,
                as: stage.as,
                join,
                on: exprToAst(stripTableRefs(stage.on, keepTables)),
              }
            : {
                expr: {
                  ast: stage.source.ast,
                  tableList: [],
                  columnList: [],
                  parentheses: true,
                },
                as: stage.as,
                join,
                on: exprToAst(stripTableRefs(stage.on, keepTables)),
              },
        ],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(stripTableRefs(item.expr, keepTables)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: null,
        limit: null,
      });
    }
    default:
      return assertNever(stage);
  }
}

function sourceToFrom(source: SourceRef): any {
  if (source.kind === "cte") {
    return { db: null, table: source.name, as: null };
  }
  return {
    db: null,
    schema: source.schema,
    table: source.name,
    as: source.as,
  };
}

function buildSelectAst(params: {
  from: any[];
  columns: any;
  where: any | null;
  groupby: any | null;
  orderby: any | null;
  limit: any | null;
}): AST {
  return {
    with: null,
    type: "select",
    options: null,
    distinct: null,
    columns: params.columns,
    into: { position: null },
    from: params.from,
    where: params.where,
    groupby: params.groupby,
    having: null,
    orderby: params.orderby,
    limit: params.limit,
    locking_read: null,
    window: null,
    collate: null,
  } as AST;
}

function hoistJoinSubquery(stage: Stage, ctes: With[]): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  const cteName = stage.as ?? `join_${ctes.length}`;
  ctes.push({
    name: { value: cteName },
    stmt: {
      ast: stage.source.ast as any,
      tableList: [],
      columnList: [],
    },
  });
  return {
    ...stage,
    source: { kind: "table", table: cteName, schema: null },
    as: stage.as === cteName ? null : stage.as,
  };
}

function stripTableRefs(
  expr: ExprNode<any>,
  keepTables?: Set<string>
): ExprNode<any> {
  switch (expr.kind) {
    case "column":
      if (!expr.table) return expr;
      if (keepTables && keepTables.has(expr.table)) return expr;
      return { ...expr, table: null };
    case "binary":
      return {
        ...expr,
        left: stripTableRefs(expr.left, keepTables),
        right: stripTableRefs(expr.right, keepTables),
      };
    case "unary":
      return { ...expr, expr: stripTableRefs(expr.expr, keepTables) };
    case "agg":
      return { ...expr, arg: stripTableRefs(expr.arg, keepTables) };
    case "group":
      return { ...expr, expr: stripTableRefs(expr.expr, keepTables) };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => stripTableRefs(arg, keepTables)),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => stripTableRefs(arg, keepTables)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => stripTableRefs(arg, keepTables))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: stripTableRefs(item.expr, keepTables),
            }))
          : null,
      };
    default:
      return expr;
  }
}

function exprToAst(expr: ExprNode<any>): any {
  switch (expr.kind) {
    case "column":
      return {
        type: "column_ref",
        table: expr.table,
        column: expr.name,
        collate: null,
      };
    case "literal":
      return literalToAst(expr.value);
    case "binary":
      return {
        type: "binary_expr",
        operator: expr.op,
        left: exprToAst(expr.left),
        right: exprToAst(expr.right),
      };
    case "unary":
      return {
        type: "unary_expr",
        operator: expr.op,
        expr: exprToAst(expr.expr),
      };
    case "agg":
      return {
        type: "aggr_func",
        name: expr.name,
        args: {
          distinct: expr.distinct ? "DISTINCT" : null,
          expr: exprToAst(expr.arg),
          orderby: null,
          separator: null,
        },
        over: null,
      };
    case "group":
      return exprToAst(expr.expr);
    case "func":
      return {
        type: "function",
        name: {
          name: [{ type: "default", value: expr.name.toLowerCase() }],
        },
        args: {
          type: "expr_list",
          value: expr.args.map(exprToAst),
        },
        over: null,
      };
    case "window":
      return {
        type: "function",
        name: {
          name: [{ type: "default", value: expr.name.toLowerCase() }],
        },
        args: {
          type: "expr_list",
          value: expr.args.map(exprToAst),
        },
        over: buildWindowOver(expr.partitionBy, expr.orderBy),
      };
    default:
      return assertNever(expr);
  }
}

function literalToAst(value: Value): any {
  if (value === null) return { type: "null", value: null };
  switch (typeof value) {
    case "string":
      return { type: "string", value };
    case "number":
      return { type: "number", value };
    case "boolean":
      return { type: "bool", value };
    default:
      return assertNever(value);
  }
}

function buildWindowOver(
  partitionBy: ExprNode<any>[] | null,
  orderBy: OrderItem[] | null
): any {
  return {
    type: "window",
    as_window_specification: {
      window_specification: {
        name: null,
        partitionby: partitionBy
          ? partitionBy.map((expr) => ({ expr: exprToAst(expr), as: null }))
          : null,
        orderby: orderBy
          ? orderBy.map((item) => ({
              expr: exprToAst(item.expr),
              type: item.direction,
            }))
          : null,
        window_frame_clause: null,
      },
      parentheses: true,
    },
  };
}

export function buildSqlOptions(
  dialectOrOpt?: Dialect | SqlOptions,
  optOrFormat?: Option | SqlFormat,
  format?: SqlFormat
): { options?: Option; sqlFormat: SqlFormat } {
  let options: Option | undefined;
  let sqlFormat: SqlFormat = "compact";

  if (dialectOrOpt && typeof dialectOrOpt === "object") {
    const { format: fmt, ...rest } = dialectOrOpt as SqlOptions;
    options = { ...rest };
    if (fmt) sqlFormat = fmt;
  } else if (typeof dialectOrOpt === "string") {
    const merged: Option = {
      ...(typeof optOrFormat === "object" && optOrFormat ? optOrFormat : {}),
    };
    merged.database = normalizeDialect(dialectOrOpt);
    options = merged;
  }

  if (typeof optOrFormat === "string") sqlFormat = optOrFormat;
  if (format) sqlFormat = format;

  return { options, sqlFormat };
}

function normalizeDialect(dialect: Dialect): string {
  const key = dialect.toString().trim().toLowerCase();
  switch (key) {
    case "mysql":
      return "MySQL";
    case "mariadb":
      return "MariaDB";
    case "postgresql":
      return "Postgresql";
    case "sqlite":
      return "SQLite";
    case "trino":
      return "Trino";
    case "transactsql":
      return "TransactSQL";
    case "redshift":
      return "Redshift";
    case "snowflake":
      return "Snowflake";
    case "bigquery":
      return "BigQuery";
    case "athena":
      return "Athena";
    case "db2":
      return "DB2";
    case "hive":
      return "Hive";
    case "flinksql":
      return "FlinkSQL";
    case "noql":
      return "NoQL";
    default:
      return dialect;
  }
}

export function formatSqlPretty(sql: string): string {
  const keywords = [
    "WITH",
    "SELECT",
    "FROM",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "INNER JOIN",
    "JOIN",
    "WHERE",
    "GROUP BY",
    "HAVING",
    "ORDER BY",
    "LIMIT",
    "ON",
  ];
  const ordered = [...keywords].sort((a, b) => b.length - a.length);
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inBracket = false;

  while (i < sql.length) {
    const ch = sql[i];
    if (!inDouble && !inBacktick && !inBracket && ch === "'") {
      inSingle = !inSingle;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inBacktick && !inBracket && ch === '"') {
      inDouble = !inDouble;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && !inBracket && ch === "`") {
      inBacktick = !inBacktick;
      out += ch;
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick && ch === "[") {
      inBracket = true;
      out += ch;
      i += 1;
      continue;
    }
    if (inBracket && ch === "]") {
      inBracket = false;
      out += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && !inBracket) {
      const match = matchKeyword(sql, i, ordered);
      if (match) {
        out = out.replace(/[ \t]+$/g, "");
        if (out.length > 0 && !out.endsWith("\n")) out += "\n";
        out += match.text;
        i += match.length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
}

export function stripRedundantQuotes(sql: string): string {
  const replacer = (full: string, id: string) => {
    if (!isSimpleIdentifier(id)) return full;
    if (isReservedKeyword(id)) return full;
    return id;
  };

  return sql
    .replace(/"([a-z0-9_]+)"/g, replacer)
    .replace(/`([a-z0-9_]+)`/g, replacer)
    .replace(/\[([a-z0-9_]+)\]/g, replacer);
}

function isSimpleIdentifier(value: string): boolean {
  return /^[a-z0-9_]+$/.test(value);
}

function isReservedKeyword(value: string): boolean {
  const keyword = value.toLowerCase();
  return RESERVED_KEYWORDS.has(keyword);
}

const RESERVED_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "group",
  "by",
  "having",
  "order",
  "limit",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "cross",
  "on",
  "as",
  "and",
  "or",
  "not",
  "null",
  "true",
  "false",
  "distinct",
  "union",
  "all",
  "exists",
  "like",
  "in",
  "is",
]);

function matchKeyword(
  sql: string,
  index: number,
  keywords: string[]
): { text: string; length: number } | null {
  for (const keyword of keywords) {
    const len = keyword.length;
    if (index + len > sql.length) continue;
    const slice = sql.slice(index, index + len);
    if (slice.toLowerCase() !== keyword.toLowerCase()) continue;
    const prev = index === 0 ? "" : sql[index - 1];
    const next = index + len >= sql.length ? "" : sql[index + len];
    if (isWordChar(prev) || isWordChar(next)) continue;
    return { text: slice, length: len };
  }
  return null;
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
