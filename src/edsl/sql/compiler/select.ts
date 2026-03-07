import type { With } from "node-sql-parser";
import type { JoinSource, QuerySpec, SourceRef, Stage } from "../../core/types";
import type { QueryDialect } from "../types";
import type { BaseFromRef, SelectAst } from "./types";
import { ensureAlias, ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { exprToAst, lateralJoinPrefix, qualifyForBase } from "./render";

export type CompileSourceRef =
  | SourceRef
  | {
      kind: "subquery";
      ast: SelectAst;
      as: string | null;
    };

export function stageToSelect(
  stage: Stage,
  source: CompileSourceRef,
  keepTables?: Set<string>,
  dialect: QueryDialect = getDefaultDialect(),
  ctePrefix = ""
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
      const compiledSubquery =
        stage.source.kind === "subquery"
          ? compileJoinSource(stage.source, `${ctePrefix}join_`, dialect)
          : null;
      const subqueryAst =
        compiledSubquery && stage.lateral
          ? ensureSelectAst(replaceOuterAlias(toParserSelect(compiledSubquery), baseAlias), "lateral join")
          : compiledSubquery;
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

export function sourceToFrom(
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

export function buildSelectAst(params: {
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

export function hoistJoinSubquery(
  stage: Stage,
  ctes: With[],
  ctePrefix: string,
  dialect: QueryDialect = getDefaultDialect()
): Stage {
  if (stage.kind !== "join" || stage.source.kind !== "subquery") return stage;
  if (stage.lateral) return stage;
  const subqueryAst = compileJoinSource(stage.source, `${ctePrefix}join_${ctes.length}_`, dialect);
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

function compileJoinSource(
  source: Extract<JoinSource, { kind: "subquery" }>,
  ctePrefix: string,
  dialect: QueryDialect
): SelectAst {
  const keepTables = source.keepTables ? new Set(source.keepTables) : undefined;
  const compiled = buildPipelineAst(source.query.source, source.query.stages, source.query.columnNames, {
    ctePrefix,
    keepTables,
    dialect,
  });
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
