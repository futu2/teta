import type { Source, SourceRef, SqlIdentifier, Value, ValuesRow } from "../../core/types.ts";
import { isValuesSource } from "../../core/types.ts";
import { identifierName } from "../../query/utils.ts";
import type { QueryDialect } from "../types.ts";
import type { BaseFromRef, FromAst, SelectAst, SelectColumnAst, SubqueryFromRef } from "./types.ts";
import { toParserSelect } from "./ast.ts";
import { getDefaultDialect } from "../dialect.ts";
import { exprToAst, getSqlRenderContext } from "./render.ts";
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

type SelectAstWithNext = SelectAst & {
  _next?: ReturnType<typeof toParserSelect>;
};

export function compileSourceRef(
  source: Source,
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect = getDefaultDialect()
): CompileSourceRef {
  if (isValuesSource(source)) {
    return {
      kind: "subquery",
      ast: buildValuesSourceAst(source.rows, columnIdentifiers, dialect),
      as: "values_0",
      columnIdentifiers,
    };
  }

  return {
    kind: "table",
    db: source.db,
    name: source.table,
    schema: source.schema,
    as: source.as,
    columnIdentifiers,
  };
}

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

function buildValuesSourceAst(
  rows: readonly ValuesRow[],
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect
): SelectAst {
  const rowSelects = rows.map((row) => buildValuesRowAst(row, columnIdentifiers, dialect));
  const [head, ...tail] = rowSelects;
  let cursor = head! as SelectAstWithNext;

  for (const nextSelect of tail) {
    cursor.set_op = "union all";
    cursor._next = toParserSelect(nextSelect);
    cursor = nextSelect as SelectAstWithNext;
  }

  return head!;
}

function buildValuesRowAst(
  row: ValuesRow,
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>,
  dialect: QueryDialect
): SelectAst {
  const renderContext = getSqlRenderContext();
  const columns: SelectColumnAst[] = Object.keys(columnIdentifiers).map((columnName) => ({
    expr: exprToAst({ kind: "literal", value: row[columnName] as Value }),
    as: renderIdentifier(columnIdentifiers[columnName]!, dialect, renderContext),
  }));

  return {
    with: null,
    type: "select",
    options: null,
    distinct: null,
    columns,
    into: { position: null },
    from: null,
    where: null,
    groupby: null,
    having: null,
    qualify: null,
    orderby: null,
    limit: null,
    locking_read: null,
    window: undefined,
    collate: null,
  };
}
