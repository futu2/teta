import type { With } from "node-sql-parser";
import type { CteSpec, ExprNode, QuerySpec, SelectItem, Stage } from "../../core/types";
import { createColumnRefs, selectAllItems } from "../../core/expr";
import type { QueryDialect } from "../types";
import type { SelectAst } from "./types";
import { ensureAlias, toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { exprToAst, qualifyForBase } from "./render";
import { buildSelectAst, sourceToFrom, stageToSelect, type CompileSourceRef } from "./select";
import { attachUnion } from "./union";

export type RecursivePart = QuerySpec;

export function createDeferredRecursiveCte(
  name: string,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart
): CteSpec {
  return {
    kind: "recursive",
    name,
    columnNames: [...columnNames],
    base,
    step,
  };
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

export function materializeCte(cte: CteSpec, dialect: QueryDialect): With {
  switch (cte.kind) {
    case "recursive":
      return buildRecursiveCte(cte.name, cte.columnNames, cte.base, cte.step, dialect);
    case "query": {
      const compiled = buildPipelineAst(cte.query.source, cte.query.stages, cte.query.columnNames, {
        ctePrefix: `${cte.name}_`,
        dialect,
      });
      const ast = compiled.ast;
      ast.with = compiled.ctes.length ? compiled.ctes : null;
      return {
        name: { value: cte.name },
        stmt: {
          ast: toParserSelect(ast),
          tableList: [],
          columnList: [],
        },
      };
    }
    default:
      return assertNever(cte);
  }
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

export function compileLoopPart(
  input: QuerySpec,
  label: "base" | "step",
  dialect: QueryDialect
): SelectAst {
  const { source, stages, columnNames } = input;
  const columns = createColumnRefs<Record<string, unknown>>(null, columnNames);
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
    compiled = stageToSelect(stage, current, undefined, dialect, `loop_${label}_${i}_`);
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
    if (item.expr.table !== null) return false;
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

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
