import type { AST, Option, With } from "node-sql-parser";
import type {
  Dialect,
  ExprNode,
  OrderItem,
  Source,
  SourceRef,
  SelectItem,
  SqlOptions,
  SqlFormat,
  Stage,
  Value,
} from "./types";
import type { ColumnRefs } from "./expr";
import { createColumnRefs, selectAllItems } from "./expr";

export function compilePipeline(
  source: Source,
  stages: Stage[],
  columns: ColumnRefs<Record<string, any>>,
  columnNames: readonly string[] | null,
  options?: { ctePrefix?: string; baseWiths?: With[] }
): AST {
  const { ast, ctes } = buildPipelineAst(
    source,
    stages,
    columns,
    columnNames,
    options
  );
  const baseWiths = options?.baseWiths ?? [];
  const merged = baseWiths.length ? [...baseWiths, ...ctes] : ctes;
  ast.with = merged.length ? merged : null;
  return ast;
}

export function buildRecursiveCte(
  name: string,
  base: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, any>>;
    columnNames: readonly string[] | null;
  },
  step: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, any>>;
    columnNames: readonly string[] | null;
  }
): With {
  const baseAst = compileLoopPart(base, "base");
  const stepAst = compileLoopPart(step, "step");
  const unionAst = attachUnion(baseAst, stepAst, "union all");
  return {
    name: { type: "default", value: name },
    stmt: {
      ast: unionAst as any,
      tableList: [],
      columnList: [],
    },
    columns: null,
    recursive: true,
  } as With;
}

function compileLoopPart(
  input: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, any>>;
    columnNames: readonly string[] | null;
  },
  label: "base" | "step"
): AST {
  const { source, stages, columns, columnNames } = input;
  const baseFrom = sourceToFrom({
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  });
  const baseAlias = ensureAlias(baseFrom);
  const from: any[] = [baseFrom];
  let whereExpr: ExprNode<any> | null = null;
  let selectItems: SelectItem[] | null = null;
  let groupBy: ExprNode<any>[] | null = null;
  let phase: "join" | "filter" | "select" = "join";
  const keepTables = new Set<string>();

  for (const stage of stages) {
    switch (stage.kind) {
      case "join": {
        if (phase !== "join") {
          throw new Error(
            `loop ${label} must place joins before filters or selects`
          );
        }
        if (stage.source.kind === "subquery") {
          const withs = (stage.source.ast as any).with;
          if (withs && withs.length) {
            throw new Error(`loop ${label} does not allow nested CTEs in joins`);
          }
        }
        if (stage.as) keepTables.add(stage.as);
        keepTables.add(baseAlias);
        const join = `${stage.joinType} JOIN`;
        from.push(
          stage.source.kind === "table"
            ? {
                db: null,
                schema: stage.source.schema,
                table: stage.source.table,
                as: stage.as,
                join,
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables)),
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
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables)),
              }
        );
        break;
      }
      case "filter": {
        if (phase === "select") {
          throw new Error(`loop ${label} must not filter after select`);
        }
        phase = "filter";
        if (whereExpr) {
          whereExpr = {
            kind: "binary",
            op: "AND",
            left: whereExpr,
            right: stage.predicate,
          };
        } else {
          whereExpr = stage.predicate;
        }
        break;
      }
      case "select": {
        if (phase === "select") {
          throw new Error(`loop ${label} only allows one select stage`);
        }
        phase = "select";
        selectItems = stage.items;
        groupBy = stage.groupBy;
        break;
      }
      case "orderBy":
      case "limit":
      case "union":
        throw new Error(`loop ${label} does not allow ${stage.kind} stages`);
      default:
        assertNever(stage);
    }
  }

  if (!selectItems) {
    selectItems = selectAllItems(columns, columnNames);
  }

  return buildSelectAst({
    from,
    columns: selectItems.map((item) => ({
      expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables)),
      as: item.as,
    })),
    where: whereExpr ? exprToAst(qualifyForBase(whereExpr, baseAlias, keepTables)) : null,
    groupby: groupBy
      ? {
          columns: groupBy.map((expr) =>
            exprToAst(qualifyForBase(expr, baseAlias, keepTables))
          ),
          modifiers: [],
        }
      : null,
    orderby: null,
    limit: null,
  });
}

function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columns: ColumnRefs<Record<string, any>>,
  columnNames: readonly string[] | null,
  options?: { ctePrefix?: string }
): { ast: AST; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  if (stages.length === 0) {
    const baseFrom = sourceToFrom({
      kind: "table",
      name: source.table,
      schema: source.schema,
      as: source.as,
    });
    const baseAlias = ensureAlias(baseFrom);
    return {
      ast: buildSelectAst({
        from: [baseFrom],
        columns: selectAllItems(columns, columnNames).map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: null,
        limit: null,
      }),
      ctes: [],
    };
  }

  const ctes: With[] = [];
  let current: SourceRef = {
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  };
  let unionCount = 0;

  for (let i = 0; i < stages.length - 1; i += 1) {
    const stage = hoistJoinSubquery(stages[i], ctes, ctePrefix);
    const stageAst =
      stage.kind === "union"
        ? compileUnionStage(stage, current, ctes, `${ctePrefix}u${unionCount}_`)
        : stageToSelect(stage, current);
    if (stage.kind === "union") unionCount += 1;
    const name = `${ctePrefix}cte_${i}`;
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

  const finalStage = hoistJoinSubquery(stages[stages.length - 1], ctes, ctePrefix);
  const finalAst =
    finalStage.kind === "union"
      ? compileUnionStage(finalStage, current, ctes, `${ctePrefix}u${unionCount}_`)
      : stageToSelect(finalStage, current);
  return { ast: finalAst as AST, ctes };
}

function stageToSelect(stage: Stage, source: SourceRef): AST {
  const baseFrom = sourceToFrom(source);
  const baseAlias = ensureAlias(baseFrom);
  switch (stage.kind) {
    case "select":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.items.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
          as: item.as,
        })),
        where: null,
        groupby: stage.groupBy
          ? {
            columns: stage.groupBy.map((expr) =>
              exprToAst(qualifyForBase(expr, baseAlias))
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
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
          as: item.as,
        })),
        where: exprToAst(qualifyForBase(stage.predicate, baseAlias)),
        groupby: null,
        orderby: null,
        limit: null,
      });
    case "orderBy":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: stage.items.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
          type: item.direction,
        })),
        limit: null,
      });
    case "limit":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
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
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables)),
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
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables)),
              },
        ],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: null,
        limit: null,
      });
    }
    case "union":
      throw new Error("union stages must be compiled by buildPipelineAst");
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

function hoistJoinSubquery(
  stage: Stage,
  ctes: With[],
  ctePrefix: string
): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  const cteName = `${ctePrefix}join_${ctes.length}`;
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
    as: stage.as,
  };
}

function compileUnionStage(
  stage: Extract<Stage, { kind: "union" }>,
  source: SourceRef,
  ctes: With[],
  rightPrefix: string
): AST {
  const baseFrom = sourceToFrom(source);
  const baseAlias = ensureAlias(baseFrom);
  const leftAst = buildSelectAst({
    from: [baseFrom],
    columns: stage.selectAll.map((item) => ({
      expr: exprToAst(qualifyForBase(item.expr, baseAlias)),
      as: item.as,
    })),
    where: null,
    groupby: null,
    orderby: null,
    limit: null,
  });

  const rightColumns = createColumnRefs<Record<string, any>>(
    null,
    stage.right.columnNames
  );
  const rightCompiled = buildPipelineAst(
    stage.right.source,
    stage.right.stages,
    rightColumns,
    stage.right.columnNames,
    { ctePrefix: rightPrefix }
  );
  if (rightCompiled.ctes.length) {
    ctes.push(...rightCompiled.ctes);
  }
  rightCompiled.ast.with = null;

  return attachUnion(leftAst, rightCompiled.ast, stage.op);
}

function attachUnion(left: AST, right: AST, op: "union" | "union all"): AST {
  const root = left as any;
  const tail = right as any;
  root.set_op = op;
  root._next = tail;
  return root as AST;
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
    case "extract":
      return {
        ...expr,
        source: stripTableRefs(expr.source, keepTables),
      };
    case "cast":
      return {
        ...expr,
        expr: stripTableRefs(expr.expr, keepTables),
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
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: stripTableRefs(item.when, keepTables),
          then: stripTableRefs(item.then, keepTables),
        })),
        elseExpr: expr.elseExpr
          ? stripTableRefs(expr.elseExpr, keepTables)
          : null,
      };
    default:
      return expr;
  }
}

function ensureAlias(from: { as?: string | null; table?: string | null }): string {
  if (from.as) return from.as;
  const base = from.table ?? "t";
  const alias = `${base}_0`;
  from.as = alias;
  return alias;
}

function qualifyMissingTables(
  expr: ExprNode<any>,
  table: string
): ExprNode<any> {
  switch (expr.kind) {
    case "column":
      if (expr.table) return expr;
      return { ...expr, table };
    case "binary":
      return {
        ...expr,
        left: qualifyMissingTables(expr.left, table),
        right: qualifyMissingTables(expr.right, table),
      };
    case "unary":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "agg":
      return {
        ...expr,
        arg: qualifyMissingTables(expr.arg, table),
      };
    case "group":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => qualifyMissingTables(arg, table)),
      };
    case "extract":
      return {
        ...expr,
        source: qualifyMissingTables(expr.source, table),
      };
    case "cast":
      return {
        ...expr,
        expr: qualifyMissingTables(expr.expr, table),
      };
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => qualifyMissingTables(arg, table)),
        partitionBy: expr.partitionBy
          ? expr.partitionBy.map((arg) => qualifyMissingTables(arg, table))
          : null,
        orderBy: expr.orderBy
          ? expr.orderBy.map((item) => ({
              ...item,
              expr: qualifyMissingTables(item.expr, table),
            }))
          : null,
      };
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: qualifyMissingTables(item.when, table),
          then: qualifyMissingTables(item.then, table),
        })),
        elseExpr: expr.elseExpr
          ? qualifyMissingTables(expr.elseExpr, table)
          : null,
      };
    default:
      return expr;
  }
}

function qualifyForBase(
  expr: ExprNode<any>,
  baseAlias: string,
  keepTables?: Set<string>
): ExprNode<any> {
  return qualifyMissingTables(stripTableRefs(expr, keepTables), baseAlias);
}

const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

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
    case "extract":
      return {
        type: "extract",
        args: {
          field: expr.field.toLowerCase(),
          cast_type: null,
          source: exprToAst(expr.source),
        },
      };
    case "cast":
      return {
        type: "cast",
        keyword: "cast",
        expr: exprToAst(expr.expr),
        symbol: "as",
        target: [{ dataType: expr.target.toUpperCase() }],
      };
    case "func": {
      const normalized = expr.name.trim();
      const upperName = normalized.toUpperCase();
      if (expr.args.length === 0 && keywordFunctions.has(upperName)) {
        return {
          type: "function",
          name: {
            name: [{ type: "origin", value: upperName }],
          },
          over: null,
        };
      }
      return {
        type: "function",
        name: {
          name: [{ type: "default", value: normalized.toLowerCase() }],
        },
        args: {
          type: "expr_list",
          value: expr.args.map(exprToAst),
        },
        over: null,
      };
    }
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
    case "case": {
      const whens = expr.whens.map((item) => {
        const cond = exprToAst(item.when);
        const result = exprToAst(item.then);
        return {
          cond,
          result,
          when: cond,
          then: result,
        };
      });
      const elseExpr = expr.elseExpr ? exprToAst(expr.elseExpr) : null;
      return {
        type: "case",
        expr: null,
        args: whens,
        default: elseExpr,
        else: elseExpr,
      };
    }
    default:
      return assertNever(expr);
  }
}

function literalToAst(value: Value): any {
  if (value === null) return { type: "null", value: null };
  if (typeof value === "object") {
    switch (value.kind) {
      case "date_literal":
        return { type: "date", value: value.value };
      case "timestamp_literal":
        return { type: "timestamp", value: value.value };
      default:
        return assertNever(value);
    }
  }
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
