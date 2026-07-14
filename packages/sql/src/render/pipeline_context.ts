import type { AST } from "node-sql-parser";
import type { QueryDialect } from "../types.ts";
import {
  createAstRenderContext,
  getSqlRenderContext,
  withSqlRenderContext,
} from "./render.ts";

export function withPipelineAstRenderContext(
  dialect: QueryDialect,
  render: () => AST
): AST {
  if (getSqlRenderContext()) {
    return render();
  }
  return withSqlRenderContext(createAstRenderContext(dialect), render);
}
