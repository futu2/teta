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
  const baseWiths = options?.baseWiths ?? [];
  const merged = baseWiths.length ? [...baseWiths, ...ctes] : ctes;
  ast.with = merged.length ? merged : null;
  return toParserAst(ast);
}

export function buildRecursiveCte(
  name: string,
  base: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, unknown>>;
    columnNames: readonly string[] | null;
  },
  step: {
    source: Source;
    stages: Stage[];
    columns: ColumnRefs<Record<string, unknown>>;
    columnNames: readonly string[] | null;
  },
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
    recursive: true,
  };
  return recursiveWith;
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
  const baseFrom = sourceToFrom({
    kind: "table",
    name: source.table,
    schema: source.schema,
    as: source.as,
  });
  const baseAlias = ensureAlias(baseFrom);
  const from: unknown[] = [baseFrom];
  let whereExpr: ExprNode<unknown> | null = null;
  let selectItems: SelectItem[] | null = null;
  let groupBy: ExprNode<unknown>[] | null = null;
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
          const subquery = ensureSelectAst(stage.source.ast, `loop ${label} join`);
          const withs = subquery.with;
          if (withs && withs.length) {
            throw new Error(`loop ${label} does not allow nested CTEs in joins`);
          }
        }
        if (stage.as) keepTables.add(stage.as);
        keepTables.add(baseAlias);
        const join = `${stage.joinType} JOIN`;
        const subqueryAst =
          stage.source.kind === "subquery" && stage.lateral
            ? ensureSelectAst(
                replaceOuterAlias(stage.source.ast, baseAlias),
                `loop ${label} lateral join`
              )
            : stage.source.kind === "subquery"
              ? ensureSelectAst(stage.source.ast, `loop ${label} join`)
              : null;
        from.push(
          stage.source.kind === "table"
            ? {
                db: null,
                schema: stage.source.schema,
                table: stage.source.table,
                as: stage.as,
                join,
                prefix: lateralJoinPrefix(stage.lateral, dialect),
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables, dialect)),
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
                on: exprToAst(qualifyForBase(stage.on, baseAlias, keepTables, dialect)),
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
      expr: exprToAst(qualifyForBase(item.expr, baseAlias, keepTables, dialect)),
      as: item.as,
    })),
    where: whereExpr
      ? exprToAst(qualifyForBase(whereExpr, baseAlias, keepTables, dialect))
      : null,
    groupby: groupBy
      ? {
          columns: groupBy.map((expr) =>
            exprToAst(qualifyForBase(expr, baseAlias, keepTables, dialect))
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

function stageToSelect(
  stage: Stage,
  source: SourceRef,
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

function sourceToFrom(source: SourceRef): BaseFromRef {
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
