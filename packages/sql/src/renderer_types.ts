import { Parser, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, QueryIR, SqlIdentifier } from "./ir/types.ts";
import type {
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParamBindings,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "./types.ts";

/** Query IR plus the output-column metadata required by the SQL renderer. */
export type QueryIRSqlTarget = Readonly<QueryIR & {
  /** Ordered output column names. */
  columnNames: readonly string[];
  /** Physical identifiers for each output column. */
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  /** Optional CTEs that must be rendered before the query body. */
  withs?: readonly CteSpec[];
}>;

/** Standalone expression input accepted by `exprToSql(...)`. */
export type ExprSqlTarget =
  | ExprNode<unknown>
  | Readonly<{ node: ExprNode<unknown> }>;

/** Internal renderer state derived from user-facing SQL options. */
export type RendererState = {
  parser: Parser;
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
  paramBindings: SqlParamBindings | undefined;
};
