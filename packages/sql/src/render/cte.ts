import type { With } from "node-sql-parser";
import type { ColumnRefAst, SelectAst } from "./types.ts";
import { toParserSelect } from "./ast.ts";

export function toCteColumnRef(name: string): ColumnRefAst {
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

export function buildNamedCte(
  name: string,
  ast: SelectAst,
  columnNames: readonly string[] = []
): With {
  return {
    name: { value: name },
    stmt: {
      ast: toParserSelect(ast),
      tableList: [],
      columnList: [],
    },
    columns: columnNames.map(toCteColumnRef),
  };
}
