/** Explicit inspection helpers that expose backend-specific representations. */

import { irToAst } from "@teta/sql";
import type { Dialect, SqlRenderStrategy } from "@teta/sql";
import { toIR } from "./src/edsl/query/render.ts";
import type { Query, QueryColumns } from "./src/edsl/query.ts";

/**
 * Lower a query to the AST produced by the configured SQL backend.
 *
 * This API is intentionally isolated from the main entrypoint because the
 * returned AST belongs to the backend parser rather than Teta's stable IR.
 */
export function toAst<TColumns extends QueryColumns>(
  query: Query<TColumns>,
  options?: { dialect?: Dialect; renderStrategy?: SqlRenderStrategy }
): ReturnType<typeof irToAst> {
  return irToAst(toIR(query), options ?? {});
}
