/**
 * SQL rendering backend for Teta query frontends.
 *
 * This package contains the shared intermediate representation (IR), dialect
 * metadata, and renderer used by Teta frontends. Most application code should
 * use the higher-level frontend package; use this backend directly when you
 * build a custom frontend, inspect generated IR, or render backend SQL yourself.
 *
 * @example Render a query IR
 * ```ts
 * import { irToSql } from "@teta/sql";
 *
 * const sql = irToSql(queryIr, { dialect: "postgresql" });
 * ```
 *
 * @module
 */

export * from "./src/errors.ts";
export * from "./src/ir/types.ts";
export * from "./src/ir/utils.ts";
export { validateQueryIR } from "./src/ir/validate.ts";
export * as ir from "./src/ir/builders.ts";
export * from "./src/types.ts";
export * from "./src/dialect.ts";
export * from "./src/language.ts";
export {
  exprToSql,
  exprToSqlResult,
  explainIR,
  irToAst,
  irToSql,
  irToSqlResult,
} from "./src/renderer.ts";
export type {
  ExprSqlTarget,
  QueryIRSqlTarget,
} from "./src/renderer_types.ts";
export {
  buildRecursiveCte,
  createDeferredRecursiveCte,
  renderPipelineAst,
} from "./src/render/pipeline.ts";
export { applyDialectFixes } from "./src/render/fixes.ts";
export { formatSqlPretty, stripRedundantQuotes } from "./src/render/format.ts";
