import type { With } from "node-sql-parser";
import type { CteSpec, InternalCteName } from "../ir/types.ts";
import { internalError, userError } from "../errors.ts";
import type { QueryDialect } from "../types.ts";
import { buildNamedCte } from "./cte.ts";
import { buildPipelineAst } from "./build.ts";
import { getDefaultDialect } from "../dialect.ts";
import { getSqlRenderContext } from "./render.ts";
import { resolveIdentifierName } from "./identifiers.ts";
import { attachUnion } from "./union.ts";
import { compileLoopPart } from "./recursive_compile.ts";
import type { RecursivePart } from "./recursive_deferred.ts";

/** Build a parser AST CTE for a recursive base/step query pair. */
export function buildRecursiveCte(
  name: InternalCteName,
  columnNames: readonly string[],
  base: RecursivePart,
  step: RecursivePart,
  dialect: QueryDialect = getDefaultDialect()
): With {
  if (!dialect.features.recursiveCte) {
    userError("UNSUPPORTED_RECURSIVE_CTE", `Dialect ${dialect.name} does not support recursive CTE`);
  }

  const renderedName = resolveIdentifierName(name, getSqlRenderContext());
  const baseAst = compileLoopPart(base, "base", dialect);
  const stepAst = compileLoopPart(step, "step", dialect);
  const unionAst = attachUnion(baseAst, stepAst, "union all");
  return {
    ...buildNamedCte(renderedName, unionAst, columnNames, {
      columnIdentifiers: base.columnIdentifiers,
      dialect,
    }),
    recursive: true,
  } as With & { recursive: boolean };
}

/** Convert a Teta CTE spec into a parser AST `WITH` item. */
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
          columnIdentifiers: cte.query.columnIdentifiers,
          dialect,
        }
      );
      const ast = compiled.ast;
      ast.with = compiled.ctes.length ? compiled.ctes : null;
      return buildNamedCte(renderedName, ast, cte.query.columnNames, {
        columnIdentifiers: cte.query.columnIdentifiers,
        dialect,
      });
    }
    default:
      return assertNever(cte);
  }
}

function assertNever(value: never): never {
  internalError("INTERNAL_UNEXPECTED_VALUE", `Unexpected value: ${String(value)}`);
}
