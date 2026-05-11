import { Parser, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, QueryIR, SqlIdentifier } from "./ir/types.ts";
import type {
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "./types.ts";

export type QueryIRSqlTarget = QueryIR & {
  columnNames: readonly string[];
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>>;
  withs?: CteSpec[];
};

export type ExprSqlTarget =
  | ExprNode<unknown>
  | { node: ExprNode<unknown> };

export type RendererState = {
  parser: Parser;
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};
