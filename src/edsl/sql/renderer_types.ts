import { Parser, type Option } from "node-sql-parser";
import type { CteSpec, ExprNode, ScopeId, Source, Stage } from "../core/types.ts";
import type {
  QueryDialect,
  SqlFormat,
  SqlOptions,
  SqlParameterMode,
  SqlParameterPrefix,
  SqlRenderStrategy,
} from "./types.ts";

export type QuerySqlTarget = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[];
  sourceScopeId: ScopeId;
  withs?: CteSpec[];
};

export type ExprSqlTarget = {
  node: ExprNode<unknown>;
};

export type SqlCompilable = QuerySqlTarget | ExprSqlTarget;

export type BuiltinSqlRendererOptions = Omit<SqlOptions, "dialect">;

export type RendererState = {
  parser: Parser;
  dialect: QueryDialect;
  options?: Option;
  sqlFormat: SqlFormat;
  renderStrategy: SqlRenderStrategy;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
};
