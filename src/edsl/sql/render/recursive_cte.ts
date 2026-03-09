import type { With } from "node-sql-parser";
import type { CteSpec, InternalCteName } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ColumnRefAst } from "./types";
import { toParserSelect } from "./ast";
import { buildPipelineAst } from "./build";
import { getDefaultDialect } from "../dialect";
import { getSqlRenderContext } from "./render";
import { resolveIdentifierName } from "./identifiers";
import { attachUnion } from "./union";
import { compileLoopPart } from "./recursive_compile";
import type { RecursivePart } from "./recursive_deferred";

export function buildRecursiveCte(
  name: InternalCteName,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart,
  dialect: QueryDialect = getDefaultDialect()
): With {
  if (!dialect.features.recursiveCte) {
    throw new Error(`Dialect ${dialect.name} does not support recursive CTE`);
  }

  const renderedName = resolveIdentifierName(name, getSqlRenderContext());
  const baseAst = compileLoopPart(base, "base", dialect);
  const stepAst = compileLoopPart(step, "step", dialect);
  const unionAst = attachUnion(baseAst, stepAst, "union all");
  return {
    name: { value: renderedName },
    stmt: {
      ast: toParserSelect(unionAst),
      tableList: [],
      columnList: [],
    },
    columns: columnNames.map(toCteColumnRef),
    recursive: true,
  } as With & { recursive: boolean };
}

export function materializeCte(cte: CteSpec, dialect: QueryDialect): With {
  const renderedName = resolveIdentifierName(cte.name, getSqlRenderContext());
  switch (cte.kind) {
    case "recursive":
      return buildRecursiveCte(cte.name, cte.columnNames, cte.base, cte.step, dialect);
    case "query": {
      const compiled = buildPipelineAst(
        cte.query.source,
        cte.query.stages,
        cte.query.columnNames,
        cte.query.scopeId,
        {
          ctePrefix: `${renderedName}_`,
          dialect,
        }
      );
      const ast = compiled.ast;
      ast.with = compiled.ctes.length ? compiled.ctes : null;
      return {
        name: { value: renderedName },
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

function toCteColumnRef(name: string): ColumnRefAst {
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

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
