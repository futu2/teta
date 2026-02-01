import { Parser, type AST, type Option } from "node-sql-parser";
import type {
  ColumnType,
  Dialect,
  ExprNode,
  InferSchema,
  JoinType,
  JoinTypeInput,
  OrderItem,
  QueryIR,
  SqlFormat,
  SqlOptions,
  Stage,
  TableOptions,
} from "./types";
import {
  ColumnRefs,
  ExprRef,
  SelectResult,
  SelectShape,
  containsGroup,
  createColumnRefs,
  dedupeExprs,
  mergeColumnNames,
  mergeColumnRefs,
  selectAllItems,
  shouldAlias,
  toExprNode,
  unwrapGroupExpr,
} from "./expr";
import {
  buildSqlOptions,
  compilePipeline,
  formatSqlPretty,
  stripRedundantQuotes,
} from "./sql";
import type { Source, JoinSource } from "./types";

export class Query<TColumns extends Record<string, any>> {
  constructor(
    readonly source: Source,
    readonly stages: Stage[],
    readonly columns: ColumnRefs<TColumns>,
    readonly columnNames: readonly string[] | null
  ) {}

  select<Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    const shape = selector(this.columns);
    const keys = Object.keys(shape);
    const items = keys.map((key) => {
      const value = shape[key];
      const expr = toExprNode(value);
      if (containsGroup(expr)) {
        throw new Error("group() is only valid inside aggregate()");
      }
      const as = shouldAlias(expr, key) ? key : null;
      return { expr, as };
    });
    const stage: Stage = {
      kind: "select",
      items,
      keys,
      groupBy: null,
    };
    const nextColumns = createColumnRefs<SelectResult<Sel>>(null, keys);
    return new Query(this.source, [...this.stages, stage], nextColumns, keys);
  }

  aggregate<Sel extends SelectShape>(
    selector: (cols: ColumnRefs<TColumns>) => Sel
  ): Query<SelectResult<Sel>> {
    const shape = selector(this.columns);
    const keys = Object.keys(shape);
    const groupBy: ExprNode<any>[] = [];
    const items = keys.map((key) => {
      const value = shape[key];
      const expr = toExprNode(value);
      const unwrapped = unwrapGroupExpr(expr, groupBy, false);
      const as = shouldAlias(unwrapped, key) ? key : null;
      return { expr: unwrapped, as };
    });

    const finalGroupBy = dedupeExprs(groupBy);
    const stage: Stage = {
      kind: "select",
      items,
      keys,
      groupBy: finalGroupBy.length ? finalGroupBy : null,
    };
    const nextColumns = createColumnRefs<SelectResult<Sel>>(null, keys);
    return new Query(this.source, [...this.stages, stage], nextColumns, keys);
  }

  filter(
    predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
  ): Query<TColumns> {
    const next = predicate(this.columns).node;
    const stage: Stage = {
      kind: "filter",
      predicate: next,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(this.source, [...this.stages, stage], this.columns, this.columnNames);
  }

  orderBy(
    selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
  ): Query<TColumns> {
    const next = selector(this.columns);
    const items = Array.isArray(next) ? next : [next];
    const stage: Stage = {
      kind: "orderBy",
      items,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(this.source, [...this.stages, stage], this.columns, this.columnNames);
  }

  limit(count: number): Query<TColumns> {
    const stage: Stage = {
      kind: "limit",
      count,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(this.source, [...this.stages, stage], this.columns, this.columnNames);
  }

  join<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>,
    joinType: JoinTypeInput = "inner"
  ): Query<TColumns & TRight> {
    const alias = autoAlias(right.source.table, this.stages);
    const rightKeys = right.columnNames ? [...right.columnNames] : null;
    const rightColumns = createColumnRefs<TRight>(alias, rightKeys);
    const predicate = on(this.columns, rightColumns).node;
    const nextColumns = mergeColumnRefs(
      this.columns,
      rightColumns,
      this.columnNames,
      rightKeys
    );
    const nextNames = mergeColumnNames(this.columnNames, rightKeys);
    const joinSource: JoinSource =
      right.stages.length === 0
        ? { kind: "table", table: right.source.table, schema: right.source.schema }
        : {
            kind: "subquery",
            ast: compilePipeline(
              right.source,
              right.stages,
              right.columns as ColumnRefs<Record<string, any>>,
              right.columnNames
            ),
          };
    const stage: Stage = {
      kind: "join",
      joinType: normalizeJoinType(joinType),
      source: joinSource,
      as: alias,
      on: predicate,
      selectAll: selectAllItems(nextColumns, nextNames),
    };
    return new Query(this.source, [...this.stages, stage], nextColumns, nextNames);
  }

  innerJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight> {
    return this.join(right, on, "inner");
  }

  leftJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight> {
    return this.join(right, on, "left");
  }

  rightJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight> {
    return this.join(right, on, "right");
  }

  fullJoin<TRight extends Record<string, any>>(
    right: Query<TRight>,
    on: (left: ColumnRefs<TColumns>, right: ColumnRefs<TRight>) => ExprRef<boolean>
  ): Query<TColumns & TRight> {
    return this.join(right, on, "full");
  }

  toIR(): QueryIR {
    return { source: this.source, stages: this.stages };
  }

  toAst(): AST {
    return compilePipeline(this.source, this.stages, this.columns, this.columnNames);
  }

  toSql(dialect?: Dialect, format?: SqlFormat): string;
  toSql(opt?: SqlOptions): string;
  toSql(
    dialectOrOpt?: Dialect | SqlOptions,
    optOrFormat?: Option | SqlFormat,
    format?: SqlFormat
  ): string {
    const parser = new Parser();
    const { options, sqlFormat } = buildSqlOptions(dialectOrOpt, optOrFormat, format);
    const sql = parser.sqlify(this.toAst(), options);
    const cleaned = stripRedundantQuotes(sql);
    return sqlFormat === "pretty" ? formatSqlPretty(cleaned) : cleaned;
  }
}

export const t = {
  string: () => ({ kind: "column_type" } as ColumnType<string>),
  number: () => ({ kind: "column_type" } as ColumnType<number>),
  boolean: () => ({ kind: "column_type" } as ColumnType<boolean>),
};

function isColumnSchema(
  value: Record<string, ColumnType<any>> | TableOptions | undefined
): value is Record<string, ColumnType<any>> {
  if (!value || typeof value !== "object") return false;
  const entries = Object.values(value);
  if (entries.length === 0) return false;
  return entries.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as ColumnType<any>).kind === "column_type"
  );
}

function parseTableName(
  name: string,
  options?: TableOptions
): { table: string; schema: string | null } {
  if (options?.schema) return { table: name, schema: options.schema };
  const parts = name.split(".");
  if (parts.length === 2) {
    return { schema: parts[0], table: parts[1] };
  }
  return { schema: null, table: name };
}

export function table<TColumns extends Record<string, any>>(
  name: string,
  options?: TableOptions
): Query<TColumns>;
export function table<S extends Record<string, ColumnType<any>>>(
  name: string,
  schema: S,
  options?: TableOptions
): Query<InferSchema<S>>;
export function table(
  name: string,
  schemaOrOptions?: Record<string, ColumnType<any>> | TableOptions,
  options?: TableOptions
): Query<Record<string, any>> {
  const schema = isColumnSchema(schemaOrOptions) ? schemaOrOptions : undefined;
  const resolvedOptions = schema ? options : (schemaOrOptions as TableOptions | undefined);
  const columnNames = schema ? Object.keys(schema) : null;
  const { table, schema: schemaName } = parseTableName(name, resolvedOptions);
  const columns = createColumnRefs(null, columnNames);
  return new Query({ table, schema: schemaName, as: null }, [], columns, columnNames);
}

function autoAlias(table: string, stages: Stage[]): string {
  const joinCount = stages.reduce((count, stage) => {
    if (stage.kind === "join") return count + 1;
    return count;
  }, 0);
  const base = table.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const name = base.length ? base : "t";
  return `${name}_j${joinCount + 1}`;
}

function normalizeJoinType(type: JoinTypeInput): JoinType {
  const normalized = type.toString().trim().toUpperCase();
  switch (normalized) {
    case "INNER":
    case "LEFT":
    case "RIGHT":
    case "FULL":
      return normalized;
    default:
      throw new Error(`Unsupported join type: ${type}`);
  }
}
