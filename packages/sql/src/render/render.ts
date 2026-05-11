import type { ExprNode } from "../ir/types.ts";
import type { QueryDialect } from "../types.ts";
import type { ParserExprAst, SqlRenderContext } from "./types.ts";
import { exprNodeToAst } from "./expr_ast.ts";
import { getSqlRenderContext } from "./render_context.ts";

export {
  createAstRenderContext,
  getSqlRenderContext,
  withSqlRenderContext,
} from "./render_context.ts";
export { bindExprScopes } from "./render_scope.ts";

export function exprToAst(
  expr: ExprNode<unknown>,
  renderContext: SqlRenderContext | null = getSqlRenderContext()
): ParserExprAst {
  return exprNodeToAst(expr, renderContext);
}

export function lateralJoinPrefix(
  lateral: boolean | undefined,
  dialect: QueryDialect
): "lateral" | undefined {
  if (!lateral) return undefined;
  return dialect.features.lateralJoinKeyword ? "lateral" : undefined;
}
