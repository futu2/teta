import type { AST } from "node-sql-parser";
import {
  createAstRenderContext,
  getSqlRenderContext,
  withSqlRenderContext,
} from "./render.ts";

export function withPipelineAstRenderContext(render: () => AST): AST {
  if (getSqlRenderContext()) {
    return render();
  }
  return withSqlRenderContext(createAstRenderContext(), render);
}
