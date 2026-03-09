import type { ExprNode } from "../../core/types";
import type { QueryDialect } from "../types";
import type { ParserExprAst, SqlRenderContext } from "./types";
import { exprNodeToAst } from "./expr_ast";
import { getSqlRenderContext } from "./render_context";

export {
  createAstRenderContext,
  getSqlRenderContext,
  withSqlRenderContext,
} from "./render_context";
export { bindExprScopes } from "./render_scope";

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
