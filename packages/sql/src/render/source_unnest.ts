import nodeSqlParser from "node-sql-parser";
import type { Stage } from "../ir/types.ts";
import { internalError, userError } from "../errors.ts";
import type { QueryDialect } from "../types.ts";
import { renderIdentifier } from "./identifiers.ts";
import { getSqlRenderContext } from "./render.ts";
import type { FromAst, ParserExprAst } from "./types.ts";

const { Parser } = nodeSqlParser;

export function buildUnnestFrom(
  stage: Extract<Stage, { kind: "unnest" }>,
  collectionExpr: ParserExprAst,
  dialect: QueryDialect
): FromAst {
  const alias = stage.as ?? fail("Unnest stage requires an alias");
  const collectionSql = exprAstToSql(collectionExpr, dialect);
  const columnSql = stage.columnNames
    .map((name) => renderIdentifierSql(stage.columnIdentifiers[name], dialect))
    .join(", ");

  switch (dialect.name) {
    case "postgresql":
      return buildJoinUnnestFrom(
        stage,
        `UNNEST(${collectionSql})${stage.withOrdinality ? " WITH ORDINALITY" : ""} AS ${alias}(${columnSql})`,
        dialect.features.lateralJoinKeyword ? "LATERAL" : undefined
      );
    case "trino":
    case "athena":
    case "duckdb":
      return buildJoinUnnestFrom(
        stage,
        `UNNEST(${collectionSql})${stage.withOrdinality ? " WITH ORDINALITY" : ""} AS ${alias}(${columnSql})`
      );
    case "hive":
    case "hetu":
      return buildLateralViewFrom(stage, alias, collectionSql, columnSql, dialect);
    default:
      userError(
        "UNSUPPORTED_UNNEST",
        `Dialect ${dialect.name} does not support unnest rendering yet`
      );
  }
}

function buildJoinUnnestFrom(
  stage: Extract<Stage, { kind: "unnest" }>,
  exprSql: string,
  prefix?: string
): FromAst {
  return {
    expr: {
      type: "default",
      value: exprSql,
    },
    as: null,
    join: stage.mode === "outer" ? "LEFT JOIN" : "CROSS JOIN",
    prefix,
    on: stage.mode === "outer"
      ? {
          type: "bool",
          value: true,
        }
      : undefined,
  };
}

function buildLateralViewFrom(
  stage: Extract<Stage, { kind: "unnest" }>,
  alias: string,
  collectionSql: string,
  columnSql: string,
  dialect: QueryDialect
): FromAst {
  const generator = stage.withOrdinality ? "POSEXPLODE" : "EXPLODE";
  const orderedColumns = stage.withOrdinality
    ? `${renderIdentifierSql(stage.columnIdentifiers[stage.columnNames[1]!], dialect)}, ${renderIdentifierSql(stage.columnIdentifiers[stage.columnNames[0]!], dialect)}`
    : columnSql;
  return {
    expr: {
      type: "default",
      value: `${stage.mode === "outer" ? "OUTER " : ""}${generator}(${collectionSql}) ${alias} AS ${orderedColumns}`,
    },
    as: null,
    join: "LATERAL VIEW",
  };
}

function exprAstToSql(expr: ParserExprAst, dialect: QueryDialect): string {
  const parser = new Parser();
  return parser.exprToSQL(
    expr,
    dialect.parserDialect ? { database: dialect.parserDialect } : undefined
  );
}

function renderIdentifierSql(
  identifier: Extract<Stage, { kind: "unnest" }>['columnIdentifiers'][string] | undefined,
  dialect: QueryDialect
): string {
  if (!identifier) {
    internalError("INTERNAL_UNNEST_IDENTIFIER_MISSING", "Unnest column identifier is missing");
  }
  const rendered = renderIdentifier(identifier, dialect, getSqlRenderContext());
  if (!rendered) {
    internalError("INTERNAL_UNNEST_IDENTIFIER_MISSING", "Unnest column identifier is missing");
  }
  return typeof rendered === "string" ? rendered : rendered.value;
}

function fail(message: string): never {
  internalError("INTERNAL_UNNEST_ALIAS_REQUIRED", message);
}
