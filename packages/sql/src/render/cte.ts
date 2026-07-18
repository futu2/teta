import type { With } from "node-sql-parser";
import type { SqlIdentifier } from "../ir/types.ts";
import { normalizeIdentifier } from "../ir/utils.ts";
import { getDefaultDialect } from "../dialect.ts";
import type { QueryDialect } from "../types.ts";
import type { ColumnRefAst, SelectAst, SqlRenderContext } from "./types.ts";
import { toParserSelect } from "./ast.ts";
import { renderIdentifier } from "./identifiers.ts";

type BuildNamedCteOptions = {
  columnIdentifiers?: Readonly<Record<string, SqlIdentifier>>;
  dialect?: QueryDialect;
  renderContext?: SqlRenderContext;
};

export function toCteColumnRef(
  name: string,
  identifier: SqlIdentifier,
  dialect: QueryDialect,
  renderContext: SqlRenderContext | null = null
): ColumnRefAst {
  const rendered = renderIdentifier(identifier, dialect, renderContext);
  const expr = typeof rendered === "string"
    ? { type: "default" as const, value: rendered }
    : rendered;
  return {
    type: "column_ref",
    table: null,
    column: { expr: expr ?? { type: "default", value: name } },
    collate: null,
  };
}

export function buildNamedCte(
  name: string,
  ast: SelectAst,
  columnNames: readonly string[] = [],
  options: BuildNamedCteOptions = {}
): With {
  const dialect = options.dialect ?? getDefaultDialect();
  return {
    name: { value: name },
    stmt: {
      ast: toParserSelect(ast),
      tableList: [],
      columnList: [],
    },
    columns: columnNames.map((columnName) =>
      toCteColumnRef(
        columnName,
        options.columnIdentifiers?.[columnName]
          ?? normalizeIdentifier(columnName, "CTE column"),
        dialect,
        options.renderContext ?? null
      )),
  };
}
