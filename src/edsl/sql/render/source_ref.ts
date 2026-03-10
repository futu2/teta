import type { SourceRef, SqlIdentifier } from "../../core/types.ts";
import { identifierName } from "../../query/utils.ts";
import type { QueryDialect } from "../types.ts";
import type { BaseFromRef, FromAst, SelectAst, SubqueryFromRef } from "./types.ts";
import { getDefaultDialect } from "../dialect.ts";
import { getSqlRenderContext } from "./render.ts";
import {
  registerIdentifierBinding,
  renderIdentifier,
  renderSourceSql,
  resolveIdentifierName,
} from "./identifiers.ts";

export type CompileSourceRef =
  | SourceRef
  | {
      kind: "subquery";
      ast: SelectAst;
      as: string | null;
      columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
    };

export function sourceToFrom(
  source: CompileSourceRef,
  dialect: QueryDialect = getDefaultDialect()
): FromAst {
  if (source.kind === "subquery") {
    const subquery: SubqueryFromRef = {
      expr: {
        ast: source.ast,
        tableList: [],
        columnList: [],
        parentheses: true,
      },
      as: source.as,
    };
    return subquery;
  }
  if (source.kind === "cte") {
    const renderContext = getSqlRenderContext();
    const renderedName = resolveIdentifierName(source.name, renderContext);
    return { db: null, table: renderedName, rawTable: renderedName, as: null };
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
          dialect,
          renderContext
        ),
      },
      rawTable: resolveIdentifierName(identifierName(params.table), renderContext),
      as: renderedAlias,
      rawAlias,
    };
  }

  return {
    db: renderIdentifier(params.db, dialect, renderContext) as string | null,
    schema: renderIdentifier(params.schema, dialect, renderContext) as string | null,
    table: renderIdentifier(params.table, dialect, renderContext) as string,
    rawTable: resolveIdentifierName(identifierName(params.table), renderContext),
    as: renderedAlias,
    rawAlias,
  };
}
