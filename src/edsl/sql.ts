import type { AST, With } from "node-sql-parser";
import type {
  ExprNode,
  OrderItem,
  QueryDialect,
  Source,
  SourceRef,
  SelectItem,
  Stage,
  Value,
} from "./types";
import type { ColumnRefs } from "./expr";
import { createColumnRefs, selectAllItems } from "./expr";
import { applyDialectLanguage } from "./language";
import type { BaseFromRef, SelectAst } from "./sql_types";
import {
  containsOuterAlias,
  ensureAlias,
  ensureSelectAst,
  replaceOuterAlias,
  toParserAst,
  toParserSelect,
} from "./sql_ast";
import { getDefaultDialect } from "./sql_dialect";

export { buildSqlOptions, cloneDialect, getDefaultDialect, resolveDialect, sameDialect } from "./sql_dialect";
export { applyDialectFixes } from "./sql_fixes";
export { formatSqlPretty, stripRedundantQuotes } from "./sql_format";

const DEFERRED_RECURSIVE_CTE_KEY = "__teta_deferred_recursive_cte__";

type RecursivePart = {
  source: Source;
  stages: Stage[];
  columns: ColumnRefs<Record<string, unknown>>;
  columnNames: readonly string[] | null;
};

type DeferredRecursiveCte = {
  name: string;
  columnNames: readonly string[];
  base: RecursivePart;
  step: RecursivePart;
};

export function compilePipeline(
  source: Source,
  stages: Stage[],
  columns: ColumnRefs<Record<string, unknown>>,
  columnNames: readonly string[] | null,
  options?: {
    ctePrefix?: string;
    baseWiths?: With[];
    keepTables?: Set<string>;
    dialect?: QueryDialect;
  }
): AST {
  const dialect = options?.dialect ?? getDefaultDialect();
  const { ast, ctes } = buildPipelineAst(
    source,
    stages,
    columns,
    columnNames,
    { ...options, dialect }
  );
  const baseWiths = (options?.baseWiths ?? []).map((item) =>
    materializeDeferredWith(item, dialect)
  );
  const merged = baseWiths.length ? [...baseWiths, ...ctes] : ctes;
  ast.with = merged.length ? merged : null;
  return toParserAst(ast);
}

export function createDeferredRecursiveCte(
  name: string,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart
): With {
  const deferred = {
    name: { value: name },
    [DEFERRED_RECURSIVE_CTE_KEY]: {
      name,
      columnNames: [...columnNames],
      base,
      step,
    } satisfies DeferredRecursiveCte,
  };
  return deferred as unknown as With;
}

export function buildRecursiveCte(
  name: string,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart,
  dialect: QueryDialect = getDefaultDialect()
): With {
  if (!dialect.features.recursiveCte) {
    throw new Error(`Dialect ${dialect.name} does not support recursive CTE`);
  }
  const baseAst = compileLoopPart(base, "base", dialect);
  const stepAst = compileLoopPart(step, "step", dialect);
  const unionAst = attachUnion(baseAst, stepAst, "union all");
  const recursiveWith: With & { recursive: boolean } = {
    name: { value: name },
    stmt: {
      ast: toParserSelect(unionAst),
      tableList: [],
      columnList: [],
    },
    columns: columnNames.map(toCteColumnRef),
    recursive: true,
  };
  return recursiveWith;
}

function materializeDeferredWith(withItem: With, dialect: QueryDialect): With {
  const raw = Reflect.get(withItem, DEFERRED_RECURSIVE_CTE_KEY);
  if (!isDeferredRecursiveCte(raw)) return withItem;
  return buildRecursiveCte(
    raw.name,
    raw.columnNames,
    raw.base,
    raw.step,
    dialect
  );
}

function isDeferredRecursiveCte(value: unknown): value is DeferredRecursiveCte {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DeferredRecursiveCte>;
  return (
    typeof candidate.name === "string" &&
    Array.isArray(candidate.columnNames) &&
    !!candidate.base &&
    !!candidate.step
  );
}

function toCteColumnRef(name: string): unknown {
  return {
    type: "column_ref",
    table: null,
    column: {
      expr: {
        type: "default",
        value: name,
      },
    },
    collate: null,
  };
}

function compileLoopPart(
  input: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, unknown>>;
    columnNames: readonly string[] | null;
  },
  label: "base" | "step",
  dialect: QueryDialect
): SelectAst {
  const { source, stages, columns, columnNames } = input;
  if (stages.length === 0) {
    const baseFrom = sourceToFrom({
      kind: "table",
      name: source.table,
      schema: source.schema,
      as: source.as,
    });
    const baseAlias = ensureAlias(baseFrom);
    return buildSelectAst({
      from: [baseFrom],
      columns: selectAllItems(columns, columnNames).map((item) => ({
        expr: exprToAst(qualifyForBase(item.expr, baseAlias, undefined, dialect)),
        as: item.as,
      })),
      where: null,
      groupby: null,
      orderby: null,
      limit: null,
    });
  }

  const optimizedStages = optimizeLoopStages(stages, columnNames, label);
  if (optimizedStages.length === 0) {
    const baseFrom = sourceToFrom({
      kind: "table",
      name: source.table,
      schema: source.schema,
      as: source.as,
    });
    const baseAlias = ensureAlias(baseFrom);
    return buildSelectAst({
      from: [baseFrom],
      columns: selectAllItems(columns, columnNames).map((item) => ({
        expr: exprToAst(qualifyForBase(item.expr, baseAlias, undefined, dialect)),
        as: item.as,
      })),
      where: null,
      groupby: null,
      orderby: null,
      limit: null,
    });
  }

  let current: CompileSourceRef = {
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  };
  let compiled: SelectAst | null = null;

  for (let i = 0; i < optimizedStages.length; i += 1) {
    const stage = optimizedStages[i]!;
    compiled = stageToSelect(stage, current, undefined, dialect);
    if (i < optimizedStages.length - 1) {
      current = {
        kind: "subquery",
        ast: compiled,
        as: `loop_${label}_${i}`,
      };
    }
  }

  if (!compiled) {
    throw new Error(`Internal error: loop ${label} did not compile`);
  }
  return compiled;
}

function optimizeLoopStages(
  stages: Stage[],
  columnNames: readonly string[] | null,
  label: "base" | "step"
): Stage[] {
  if (stages.length === 0) return [];
  const planned: Stage[] = new Array(stages.length);
  const initialNeeded = columnNames
    ? new Set<string>(columnNames)
    : stageOutputNames(stages[stages.length - 1]!)
      ? new Set<string>(stageOutputNames(stages[stages.length - 1]!)!)
      : new Set<string>();
  let needed = initialNeeded;

  for (let i = stages.length - 1; i >= 0; i -= 1) {
    const stage = stages[i]!;
    validateLoopStage(stage, label);
    switch (stage.kind) {
      case "select": {
        const keptIndexes = stage.keys
          .map((key, idx) => ({ key, idx }))
          .filter(({ key }) => needed.has(key))
          .map(({ idx }) => idx);
        const useAll = keptIndexes.length === 0;
        const items = useAll ? stage.items : keptIndexes.map((idx) => stage.items[idx]!);
        const keys = useAll ? stage.keys : keptIndexes.map((idx) => stage.keys[idx]!);
        const before = new Set<string>();
        items.forEach((item) => collectExprColumns(item.expr, before));
        stage.groupBy?.forEach((expr) => collectExprColumns(expr, before));
        needed = before;
        planned[i] =
          items.length === stage.items.length
            ? stage
            : {
                ...stage,
                items,
                keys,
              };
        break;
      }
      case "filter": {
        const selectAll = pruneSelectItems(stage.selectAll, needed);
        const before = new Set<string>(needed);
        collectExprColumns(stage.predicate, before);
        needed = before;
        planned[i] =
          selectAll === stage.selectAll
            ? stage
            : {
                ...stage,
                selectAll,
              };
        break;
      }
      case "join": {
        const selectAll = pruneSelectItems(stage.selectAll, needed);
        const before = new Set<string>();
        selectAll.forEach((item) =>
          collectExprColumns(item.expr, before, { excludeTable: stage.as })
        );
        collectExprColumns(stage.on, before, { excludeTable: stage.as });
        needed = before.size ? before : new Set<string>(needed);
        planned[i] =
          selectAll === stage.selectAll
            ? stage
            : {
                ...stage,
                selectAll,
              };
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

  return mergeAdjacentLoopFilters(removeNoOpLoopSelects(planned));
}

function validateLoopStage(stage: Stage, label: "base" | "step"): void {
  switch (stage.kind) {
    case "orderBy":
    case "limit":
    case "union":
      throw new Error(`loop ${label} does not allow ${stage.kind} stages`);
    case "join":
      if (stage.source.kind === "subquery") {
        const subquery = ensureSelectAst(stage.source.ast, `loop ${label} join`);
        const withs = subquery.with;
        if (withs && withs.length) {
          throw new Error(`loop ${label} does not allow nested CTEs in joins`);
        }
      }
      break;
    default:
      break;
  }
}

function mergeAdjacentLoopFilters(stages: Stage[]): Stage[] {
  if (stages.length < 2) return stages;
  const merged: Stage[] = [];
  for (const stage of stages) {
    const prev = merged[merged.length - 1];
    if (stage.kind === "filter" && prev?.kind === "filter") {
      merged[merged.length - 1] = {
        kind: "filter",
        predicate: {
          kind: "binary",
          op: "AND",
          left: prev.predicate,
          right: stage.predicate,
        },
        selectAll: stage.selectAll,
      };
      continue;
    }
    merged.push(stage);
  }
  return merged;
}

function removeNoOpLoopSelects(stages: Stage[]): Stage[] {
  const compact: Stage[] = [];
  let inputNames: readonly string[] | null = null;
  for (const stage of stages) {
    if (stage.kind === "select" && isNoOpLoopSelect(stage, inputNames)) {
      continue;
    }
    compact.push(stage);
    inputNames = stageOutputNames(stage);
  }
  return compact;
}

function isNoOpLoopSelect(
  stage: Extract<Stage, { kind: "select" }>,
  inputNames: readonly string[] | null
): boolean {
  if (!inputNames) return false;
  if (stage.groupBy && stage.groupBy.length > 0) return false;
  if (inputNames.length !== stage.keys.length) return false;
  for (let i = 0; i < stage.keys.length; i += 1) {
    const key = stage.keys[i]!;
    const input = inputNames[i]!;
    const item = stage.items[i];
    if (!item) return false;
    if (key !== input) return false;
    if (item.as && item.as !== key) return false;
    if (item.expr.kind !== "column") return false;
    if (item.expr.name !== key) return false;
  }
  return true;
}

function stageOutputNames(stage: Stage): readonly string[] | null {
  switch (stage.kind) {
    case "select":
      return stage.keys;
    case "filter":
    case "join":
    case "orderBy":
    case "limit":
      return selectItemNames(stage.selectAll);
    case "union":
      return null;
    default:
      return assertNever(stage);
  }
}

function selectItemNames(items: SelectItem[]): string[] | null {
  const names: string[] = [];
  for (const item of items) {
    const name = selectItemName(item);
    if (!name) return null;
    names.push(name);
  }
  return names;
}

function pruneSelectItems(items: SelectItem[], needed: ReadonlySet<string>): SelectItem[] {
  const pruned = items.filter((item) => {
    const name = selectItemName(item);
    if (!name) return true;
    return needed.has(name);
  });
  if (pruned.length === 0 || pruned.length === items.length) return items;
  return pruned;
}

function selectItemName(item: SelectItem): string | null {
  if (item.as) return item.as;
  if (item.expr.kind === "column") return item.expr.name;
  return null;
}

function collectExprColumns(
  expr: ExprNode<unknown>,
  out: Set<string>,
  options?: { excludeTable?: string | null }
): void {
  switch (expr.kind) {
    case "column":
      if (options?.excludeTable !== undefined && expr.table === options.excludeTable) {
        return;
      }
      out.add(expr.name);
      return;
    case "binary":
      collectExprColumns(expr.left, out, options);
      collectExprColumns(expr.right, out, options);
      return;
    case "unary":
      collectExprColumns(expr.expr, out, options);
      return;
    case "agg":
      collectExprColumns(expr.arg, out, options);
      return;
    case "group":
      collectExprColumns(expr.expr, out, options);
      return;
    case "func":
      expr.args.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "list":
      expr.items.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "array":
      expr.items.forEach((arg) => collectExprColumns(arg, out, options));
      return;
    case "extract":
      collectExprColumns(expr.source, out, options);
      return;
    case "cast":
      collectExprColumns(expr.expr, out, options);
      return;
    case "window":
      expr.args.forEach((arg) => collectExprColumns(arg, out, options));
      expr.partitionBy?.forEach((arg) => collectExprColumns(arg, out, options));
      expr.orderBy?.forEach((item) => collectExprColumns(item.expr, out, options));
      return;
    case "case":
      expr.whens.forEach((item) => {
        collectExprColumns(item.when, out, options);
        collectExprColumns(item.then, out, options);
      });
      if (expr.elseExpr) collectExprColumns(expr.elseExpr, out, options);
      return;
    case "literal":
      return;
    default:
      assertNever(expr);
  }
}

function buildPipelineAst(
  source: Source,
  stages: Stage[],
  columns: ColumnRefs<Record<string, unknown>>,
  columnNames: readonly string[] | null,
  options?: {
    ctePrefix?: string;
    keepTables?: Set<string>;
    dialect?: QueryDialect;
  }
): { ast: SelectAst; ctes: With[] } {
  const ctePrefix = options?.ctePrefix ?? "";
  const keepTables = options?.keepTables;
  const dialect = options?.dialect ?? getDefaultDialect();
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
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
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
    const stage = hoistJoinSubquery(stages[i]!, ctes, ctePrefix);
    const stageAst =
      stage.kind === "union"
        ? compileUnionStage(
            stage,
            current,
            ctes,
            `${ctePrefix}u${unionCount}_`,
            keepTables,
            dialect
          )
        : stageToSelect(stage, current, keepTables, dialect);
    if (stage.kind === "union") unionCount += 1;
    const name = `${ctePrefix}cte_${i}`;
    ctes.push({
      name: { value: name },
      stmt: {
        ast: toParserSelect(stageAst),
        tableList: [],
        columnList: [],
      },
    });
    current = { kind: "cte", name };
  }

  const finalStage = hoistJoinSubquery(stages[stages.length - 1]!, ctes, ctePrefix);
  const finalAst =
    finalStage.kind === "union"
      ? compileUnionStage(
          finalStage,
          current,
          ctes,
          `${ctePrefix}u${unionCount}_`,
          keepTables,
          dialect
        )
      : stageToSelect(finalStage, current, keepTables, dialect);
  return { ast: finalAst, ctes };
}

type CompileSourceRef =
  | SourceRef
  | {
      kind: "subquery";
      ast: SelectAst;
      as: string | null;
    };

function stageToSelect(
  stage: Stage,
  source: CompileSourceRef,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect()
): SelectAst {
  const baseFrom = sourceToFrom(source);
  const baseAlias = ensureAlias(baseFrom);
  switch (stage.kind) {
    case "select":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.items.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
          as: item.as,
        })),
        where: null,
        groupby: stage.groupBy
          ? {
            columns: stage.groupBy.map((expr) =>
              exprToAst(qualifyForBase(expr, baseAlias, keepTables, dialect))
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
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
          as: item.as,
        })),
        where: exprToAst(qualifyForBase(stage.predicate, baseAlias, keepTables, dialect)),
        groupby: null,
        orderby: null,
        limit: null,
      });
    case "orderBy":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
          as: item.as,
        })),
        where: null,
        groupby: null,
        orderby: stage.items.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
          type: item.direction,
        })),
        limit: null,
      });
    case "limit":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
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
      const nextKeep = new Set<string>(keepTables ?? []);
      if (stage.as) nextKeep.add(stage.as);
      nextKeep.add(baseAlias);
      const subqueryAst =
        stage.source.kind === "subquery" && stage.lateral
          ? ensureSelectAst(
              replaceOuterAlias(stage.source.ast, baseAlias),
              "lateral join"
            )
          : stage.source.kind === "subquery"
            ? ensureSelectAst(stage.source.ast, "join")
            : null;
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
                prefix: lateralJoinPrefix(stage.lateral, dialect),
                on: exprToAst(qualifyForBase(stage.on, baseAlias, nextKeep, dialect)),
              }
            : {
                expr: {
                  ast: subqueryAst,
                  tableList: [],
                  columnList: [],
                  parentheses: true,
                },
                as: stage.as,
                join,
                prefix: lateralJoinPrefix(stage.lateral, dialect),
                on: exprToAst(qualifyForBase(stage.on, baseAlias, nextKeep, dialect)),
              },
        ],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(qualifyForBase(item.expr, baseAlias, nextKeep, dialect)),
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

function sourceToFrom(
  source: CompileSourceRef
):
  | BaseFromRef
  | {
      expr: {
        ast: SelectAst;
        tableList: [];
        columnList: [];
        parentheses: true;
      };
      as: string | null;
    } {
  if (source.kind === "subquery") {
    return {
      expr: {
        ast: source.ast,
        tableList: [],
        columnList: [],
        parentheses: true,
      },
      as: source.as,
    };
  }
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
  from: unknown[];
  columns: unknown;
  where: unknown | null;
  groupby: unknown | null;
  orderby: unknown | null;
  limit: unknown | null;
}): SelectAst {
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
    window: undefined,
    collate: null,
  };
}

function hoistJoinSubquery(
  stage: Stage,
  ctes: With[],
  ctePrefix: string
): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  if (stage.lateral && containsOuterAlias(stage.source.ast)) return stage;
  const subqueryAst = ensureSelectAst(stage.source.ast, "join subquery");
  if (subqueryAst.with && subqueryAst.with.length) {
    ctes.push(...subqueryAst.with);
    subqueryAst.with = null;
  }
  const cteName = `${ctePrefix}join_${ctes.length}`;
  ctes.push({
    name: { value: cteName },
    stmt: {
      ast: toParserSelect(subqueryAst),
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
  rightPrefix: string,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect()
): SelectAst {
  const baseFrom = sourceToFrom(source);
  const baseAlias = ensureAlias(baseFrom);
  const leftAst = buildSelectAst({
    from: [baseFrom],
    columns: stage.selectAll.map((item) => ({
      expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
      as: item.as,
    })),
    where: null,
    groupby: null,
    orderby: null,
    limit: null,
  });

  const rightColumns = createColumnRefs<Record<string, unknown>>(null, stage.right.columnNames);
  const rightCompiled = buildPipelineAst(
    stage.right.source,
    stage.right.stages,
    rightColumns,
    stage.right.columnNames,
    { ctePrefix: rightPrefix, keepTables, dialect }
  );
  if (rightCompiled.ctes.length) {
    ctes.push(...rightCompiled.ctes);
  }
  const rightAst = rightCompiled.ast;
  rightAst.with = null;

  return attachUnion(leftAst, rightAst, stage.op);
}

function attachUnion(
  left: SelectAst,
  right: SelectAst,
  op: "union" | "union all"
): SelectAst {
  left.set_op = op;
  left._next = toParserSelect(right);
  return left;
}

function stripTableRefs(
  expr: ExprNode<unknown>,
  keepTables?: Set<string>
): ExprNode<unknown> {
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
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => stripTableRefs(item, keepTables)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => stripTableRefs(item, keepTables)),
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

function qualifyMissingTables(
  expr: ExprNode<unknown>,
  table: string
): ExprNode<unknown> {
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
    case "list":
      return {
        ...expr,
        items: expr.items.map((item) => qualifyMissingTables(item, table)),
      };
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => qualifyMissingTables(item, table)),
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
  expr: ExprNode<unknown>,
  baseAlias: string,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect()
): ExprNode<unknown> {
  return applyDialectLanguage(
    qualifyMissingTables(stripTableRefs(expr, keepTables), baseAlias),
    dialect
  );
}

const keywordFunctions = new Set(["CURRENT_DATE", "CURRENT_TIMESTAMP"]);

function exprToAst(expr: ExprNode<unknown>): unknown {
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
      if (upperName === "POSITION" && expr.args.length === 2) {
        return {
          type: "function",
          name: {
            name: [{ type: "origin", value: "position" }],
          },
          separator: " ",
          args: {
            type: "expr_list",
            value: [
              exprToAst(expr.args[0]!),
              { type: "origin", value: "in" },
              exprToAst(expr.args[1]!),
            ],
          },
          over: null,
        };
      }
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
    case "list":
      return {
        type: "expr_list",
        value: expr.items.map(exprToAst),
      };
    case "array":
      return {
        type: "array",
        keyword: "array",
        expr_list: {
          type: "expr_list",
          value: expr.items.map(exprToAst),
        },
        brackets: true,
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
    case "case": {
      const whens = expr.whens.map((item) => ({
        type: "when",
        cond: exprToAst(item.when),
        result: exprToAst(item.then),
      }));
      const args = expr.elseExpr
        ? [
            ...whens,
            {
              type: "else",
              result: exprToAst(expr.elseExpr),
            },
          ]
        : whens;
      return {
        type: "case",
        expr: null,
        args,
      };
    }
    default:
      return assertNever(expr);
  }
}

function literalToAst(value: Value): unknown {
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
  partitionBy: ExprNode<unknown>[] | null,
  orderBy: OrderItem[] | null
): unknown {
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

function lateralJoinPrefix(
  lateral: boolean | undefined,
  dialect: QueryDialect
): "lateral" | undefined {
  if (!lateral) return undefined;
  return dialect.features.lateralJoinKeyword ? "lateral" : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
