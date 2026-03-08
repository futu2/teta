import type { With } from "node-sql-parser";
import type { JoinSource, SourceRef, SqlIdentifier, Stage } from "../../core/types";
import { identifierName } from "../../query/utils";
import type { QueryDialect } from "../types";
import type { BaseFromRef, ScopeBindings, SelectAst } from "./types";
import { ensureAlias, ensureSelectAst, replaceOuterAlias, toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { getSqlRenderContext, bindExprScopes, exprToAst, lateralJoinPrefix } from "./render";
import {
  registerColumnIdentifierBindings,
  registerIdentifierBinding,
  renderIdentifier,
  renderSourceSql,
} from "./identifiers";

export type CompileSourceRef =
  | SourceRef
  | {
      kind: "subquery";
      ast: SelectAst;
      as: string | null;
      columnIdentifiers?: Readonly<Record<string, SqlIdentifier>> | null;
    };

export function stageToSelect(
  stage: Stage,
  source: CompileSourceRef,
  sourceScopeId: string,
  inheritedBindings: ScopeBindings | undefined,
  dialect: QueryDialect = getDefaultDialect(),
  ctePrefix = ""
): SelectAst {
  const baseFrom = sourceToFrom(source, dialect);
  const baseAlias = ensureAlias(baseFrom);
  registerSourceColumnBindings(source, baseAlias, dialect);
  const baseBindings: ScopeBindings = {
    ...(inheritedBindings ?? {}),
    [sourceScopeId]: baseAlias,
  };

  switch (stage.kind) {
    case "select":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.items.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
          as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
        })),
        where: null,
        groupby: stage.groupBy
          ? {
              columns: stage.groupBy.map((expr) =>
                exprToAst(bindExprScopes(expr, baseBindings, dialect))
              ),
              modifiers: [],
            }
          : null,
        having: null,
        qualify: null,
        orderby: null,
        limit: null,
      });
    case "filter":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
          as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
        })),
        where: exprToAst(bindExprScopes(stage.predicate, baseBindings, dialect)),
        groupby: null,
        having: null,
        qualify: null,
        orderby: null,
        limit: null,
      });
    case "orderBy":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
          as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
        })),
        where: null,
        groupby: null,
        having: null,
        qualify: null,
        orderby: stage.items.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
          type: item.direction,
        })),
        limit: null,
      });
    case "limit":
      return buildSelectAst({
        from: [baseFrom],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, baseBindings, dialect)),
          as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
        })),
        where: null,
        groupby: null,
        having: null,
        qualify: null,
        orderby: null,
        limit: {
          seperator: "",
          value: [{ type: "number", value: stage.count }],
        },
      });
    case "join": {
      const join = `${stage.joinType} JOIN`;
      const rightAlias = stage.as ?? fail("Join stage requires an alias");
      const joinBindings: ScopeBindings = {
        ...baseBindings,
        [stage.rightScopeId]: rightAlias,
      };
      registerColumnIdentifierBindings(
        rightAlias,
        stage.source.kind === "table"
          ? stage.source.columnIdentifiers ?? null
          : stage.source.query.columnIdentifiers,
        dialect,
        getSqlRenderContext()
      );
      const compiledSubquery =
        stage.source.kind === "subquery"
          ? compileJoinSource(stage.source, `${ctePrefix}join_`, dialect)
          : null;
      const subqueryAst =
        compiledSubquery && stage.lateral
          ? ensureSelectAst(
              replaceOuterAlias(toParserSelect(compiledSubquery), baseAlias),
              "lateral join"
            )
          : compiledSubquery;
      return buildSelectAst({
        from: [
          baseFrom,
          stage.source.kind === "table"
            ? {
                ...buildTableFromRef({
                  db: stage.source.db,
                  schema: stage.source.schema,
                  table: stage.source.table,
                  alias: stage.as,
                }, dialect),
                join,
                prefix: lateralJoinPrefix(stage.lateral, dialect),
                on: exprToAst(bindExprScopes(stage.on, joinBindings, dialect)),
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
                on: exprToAst(bindExprScopes(stage.on, joinBindings, dialect)),
              },
        ],
        columns: stage.selectAll.map((item) => ({
          expr: exprToAst(bindExprScopes(item.expr, joinBindings, dialect)),
          as: renderIdentifier(item.as, dialect, getSqlRenderContext()),
        })),
        where: null,
        groupby: null,
        having: null,
        qualify: null,
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

function registerSourceColumnBindings(
  source: CompileSourceRef,
  tableAlias: string,
  dialect: QueryDialect
): void {
  registerColumnIdentifierBindings(
    tableAlias,
    source.columnIdentifiers ?? null,
    dialect,
    getSqlRenderContext()
  );
}

export function sourceToFrom(
  source: CompileSourceRef,
  dialect: QueryDialect = getDefaultDialect()
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
    return { db: null, table: source.name, rawTable: source.name, as: null };
  }
  return buildTableFromRef(
    {
      db: source.db,
      schema: source.schema,
      table: source.name,
      alias: source.as,
    },
    dialect
  );
}

export function buildSelectAst(params: {
  from: unknown[];
  columns: unknown;
  where: unknown | null;
  groupby: unknown | null;
  having: unknown | null;
  qualify: unknown | null;
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
    having: params.having,
    qualify: params.qualify,
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
    source: {
      kind: "table",
      db: null,
      table: { name: cteName, quoted: false },
      schema: null,
      columnIdentifiers: stage.source.query.columnIdentifiers,
    },
    as: stage.as,
  };
}

function compileJoinSource(
  source: JoinSource & { kind: "subquery" },
  ctePrefix: string,
  dialect: QueryDialect
): SelectAst {
  const compiled = buildPipelineAst(
    source.query.source,
    source.query.stages,
    source.query.columnNames,
    source.query.scopeId,
    {
      ctePrefix,
      scopeBindings: source.inheritedBindings ?? undefined,
      dialect,
    }
  );
  const ast = compiled.ast;
  ast.with = compiled.ctes.length ? compiled.ctes : null;
  return ast;
}

export function buildTableFromRef(
  params: {
    db: SqlIdentifier | null;
    schema: SqlIdentifier | null;
    table: SqlIdentifier;
    alias: SqlIdentifier | string | null;
  },
  dialect: QueryDialect
): BaseFromRef {
  const renderContext = getSqlRenderContext();
  const rawAlias =
    typeof params.alias === "string"
      ? params.alias
      : params.alias
        ? identifierName(params.alias)
        : null;
  if (typeof params.alias !== "string") {
    registerIdentifierBinding(rawAlias, params.alias, dialect, renderContext);
  }
  const renderedAlias =
    typeof params.alias === "string"
      ? params.alias
      : renderIdentifier(params.alias, dialect, renderContext);

  if (renderContext?.mode === "ast") {
    return {
      type: "expr",
      expr: {
        type: "default",
        value: renderSourceSql(
          {
            db: params.db,
            schema: params.schema,
            table: params.table,
          },
          dialect
        ),
      },
      rawTable: identifierName(params.table),
      as: renderedAlias,
      rawAlias,
    };
  }

  return {
    db: renderIdentifier(params.db, dialect, renderContext) as string | null,
    schema: renderIdentifier(params.schema, dialect, renderContext) as string | null,
    table: renderIdentifier(params.table, dialect, renderContext) as string,
    rawTable: identifierName(params.table),
    as: renderedAlias,
    rawAlias,
  };
}

function fail(message: string): never {
  throw new Error(message);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
