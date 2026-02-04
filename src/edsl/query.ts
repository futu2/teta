import { Parser, type AST, type Option, type With } from "node-sql-parser";
import type {
  ColumnType,
  Dialect,
  ExprNode,
  InferSchema,
  JoinType,
  JoinTypeInput,
  OrderItem,
  QueryIR,
  QuerySpec,
  SqlFloat,
  SqlInt,
  SqlDate,
  SqlFormat,
  SqlOptions,
  SqlTimestamp,
  Stage,
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
  buildRecursiveCte,
  compilePipeline,
  formatSqlPretty,
  stripRedundantQuotes,
} from "./sql";
import type { Source, JoinSource } from "./types";

/** Composable query builder with typed columns and SQL rendering. */
export class Query<TColumns extends Record<string, any>> {
  constructor(
    readonly source: Source,
    readonly stages: Stage[],
    readonly columns: ColumnRefs<TColumns>,
    readonly columnNames: readonly string[] | null,
    readonly withs: With[] = []
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
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      keys,
      this.withs
    );
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
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      keys,
      this.withs
    );
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
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
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
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
  }

  limit(count: number): Query<TColumns> {
    const stage: Stage = {
      kind: "limit",
      count,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      this.withs
    );
  }

  unionAll(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union all");
  }

  union(right: Query<TColumns>): Query<TColumns> {
    return this.unionInternal(right, "union");
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
              right.columnNames,
              { ctePrefix: `${alias}_` }
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
    return new Query(
      this.source,
      [...this.stages, stage],
      nextColumns,
      nextNames,
      mergeWiths(this.withs, right.withs)
    );
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
    return compilePipeline(
      this.source,
      this.stages,
      this.columns,
      this.columnNames,
      { baseWiths: this.withs }
    );
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

  private unionInternal(right: Query<TColumns>, op: "union" | "union all"): Query<TColumns> {
    const leftNames = this.columnNames;
    const rightNames = right.columnNames;
    if (!leftNames || !rightNames) {
      throw new Error("union requires both queries to have explicit column lists");
    }
    assertUnionCompatible(leftNames, rightNames);
    const rightSpec: QuerySpec = {
      source: right.source,
      stages: right.stages,
      columnNames: right.columnNames,
    };
    const stage: Stage = {
      kind: "union",
      op,
      right: rightSpec,
      selectAll: selectAllItems(this.columns, this.columnNames),
    };
    return new Query(
      this.source,
      [...this.stages, stage],
      this.columns,
      this.columnNames,
      mergeWiths(this.withs, right.withs)
    );
  }
}

/** Column type helpers for table schemas. */
export const t = {
  string: () => ({ kind: "column_type" } as ColumnType<string>),
  int: () => ({ kind: "column_type" } as ColumnType<SqlInt>),
  float: () => ({ kind: "column_type" } as ColumnType<SqlFloat>),
  boolean: () => ({ kind: "column_type" } as ColumnType<boolean>),
  date: () => ({ kind: "column_type" } as ColumnType<SqlDate>),
  timestamp: () => ({ kind: "column_type" } as ColumnType<SqlTimestamp>),
};

function parseTableName(name: string): { table: string; schema: string | null } {
  const parts = name.split(".");
  if (parts.length === 2) {
    return { schema: parts[0], table: parts[1] };
  }
  return { schema: null, table: name };
}

/** Define a table with a schema and return a typed query builder. */
export function table<S extends Record<string, ColumnType<any>>>(
  name: string,
  schema: S
): Query<InferSchema<S>> {
  const columnNames = Object.keys(schema);
  const { table, schema: schemaName } = parseTableName(name);
  const columns = createColumnRefs(null, columnNames);
  return new Query(
    { table, schema: schemaName, as: null },
    [],
    columns,
    columnNames,
    []
  );
}

let loopCounter = 0;

/** Build a recursive CTE query with a base and step query. */
export function loop<S extends Record<string, ColumnType<any>>>(
  schema: S,
  builder: (self: Query<InferSchema<S>>) => {
    base: Query<InferSchema<S>>;
    step: Query<InferSchema<S>>;
  }
): Query<InferSchema<S>> {
  const name = `loop_${loopCounter++}`;
  const self = table(name, schema);
  const { base, step } = builder(self);
  const schemaKeys = Object.keys(schema);
  assertLoopSchema(schemaKeys, base.columnNames, "base");
  assertLoopSchema(schemaKeys, step.columnNames, "step");
  assertLoopColumns(base.columnNames, step.columnNames);
  if (base.withs.length || step.withs.length) {
    throw new Error("loop does not allow nested CTEs in base or step queries");
  }
  const recursiveCte = buildRecursiveCte(
    name,
    {
      source: base.source,
      stages: base.stages,
      columns: base.columns as ColumnRefs<Record<string, any>>,
      columnNames: base.columnNames,
    },
    {
      source: step.source,
      stages: step.stages,
      columns: step.columns as ColumnRefs<Record<string, any>>,
      columnNames: step.columnNames,
    }
  );
  const columnNames = Object.keys(schema);
  const columns = createColumnRefs<InferSchema<S>>(null, columnNames);
  return new Query(
    { table: name, schema: null, as: null },
    [],
    columns,
    columnNames,
    [recursiveCte]
  );
}

function autoAlias(table: string, stages: Stage[]): string {
  const joinCount = stages.reduce((count, stage) => {
    if (stage.kind === "join") return count + 1;
    return count;
  }, 0);
  const base = table.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const name = base.length ? base : "t";
  return `${name}_${joinCount + 1}`;
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

function assertUnionCompatible(
  left: readonly string[],
  right: readonly string[]
): void {
  if (left.length !== right.length) {
    throw new Error("union requires both queries to have the same columns");
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      throw new Error("union requires both queries to have matching column names");
    }
  }
}

function assertLoopColumns(
  base: readonly string[] | null,
  step: readonly string[] | null
): void {
  if (!base || !step) {
    throw new Error("loop requires explicit column lists for base and step");
  }
  assertUnionCompatible(base, step);
}

function assertLoopSchema(
  schemaKeys: readonly string[],
  names: readonly string[] | null,
  label: "base" | "step"
): void {
  if (!names) {
    throw new Error(`loop ${label} must return explicit columns`);
  }
  assertUnionCompatible(schemaKeys, names);
}

function mergeWiths(left: With[], right: With[]): With[] {
  if (left.length === 0) return right.length ? [...right] : [];
  if (right.length === 0) return [...left];
  const seen = new Set<string>();
  const merged: With[] = [];
  for (const item of left) {
    const name = withName(item);
    if (name) seen.add(name);
    merged.push(item);
  }
  for (const item of right) {
    const name = withName(item);
    if (name && seen.has(name)) {
      throw new Error(`CTE name conflict: ${name}`);
    }
    if (name) seen.add(name);
    merged.push(item);
  }
  return merged;
}

function withName(item: With): string | null {
  const raw = (item as any).name;
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw.value === "string") return raw.value;
  if (Array.isArray(raw) && typeof raw[0]?.value === "string") return raw[0].value;
  return null;
}
