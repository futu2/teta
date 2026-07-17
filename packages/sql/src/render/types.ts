import type { Select, SortDirection, ValueExpr } from "node-sql-parser";
import type { InternalCteName, ScopeId } from "../ir/types.ts";
import type { SqlParam, SqlParamBindings, SqlParameterMode, SqlParameterPrefix } from "../types.ts";

export type AstValueExpr<T = string | number | boolean> = ValueExpr<T>;

export type AstIdentifierExpr = AstValueExpr<string> & {
  type: "default";
  value: string;
};

export type AstKeywordExpr = AstValueExpr<string> & {
  type: "origin";
  value: string;
};

export type LiteralAst =
  | { type: "null"; value: null }
  | { type: "string"; value: string }
  | { type: "default"; value: string }
  | { type: "number"; value: number | string }
  | { type: "bool"; value: boolean }
  | { type: "date"; value: string }
  | { type: "timestamp"; value: string };

export type ParamAst = {
  type: "param";
  value: string;
  prefix?: string;
};

export type ExprListItemAst = ParserExprAst | AstKeywordExpr;

export type ExprListAst = {
  type: "expr_list";
  value: ExprListItemAst[];
  parentheses?: boolean;
  separator?: string;
};

export type ColumnRefAst = {
  type: "column_ref";
  table: string | AstIdentifierExpr | null;
  column: string | AstIdentifierExpr | { expr: AstIdentifierExpr };
  collate?: null;
  options?: ExprListAst;
  order_by?: SortDirection | null;
};

export type UnaryExprAst = {
  type: "unary_expr";
  operator: string;
  expr: ParserExprAst;
};

export type BinaryExprAst = {
  type: "binary_expr";
  operator: string;
  left: ParserExprAst | ExprListAst;
  right: ParserExprAst | ExprListAst;
  parentheses?: boolean;
};

export type OrderByAst = {
  expr: ParserExprAst;
  type: "ASC" | "DESC";
};

export type WindowPartitionItemAst = {
  expr: ParserExprAst;
  as: null;
};

export type WindowOverAst = {
  type: "window";
  as_window_specification: {
    window_specification: {
      name: null;
      partitionby: WindowPartitionItemAst[] | null;
      orderby: OrderByAst[] | null;
      window_frame_clause: string | null;
    };
    parentheses: true;
  };
};

export type AggrFuncAst = {
  type: "aggr_func";
  name: string;
  args: {
    expr: ParserExprAst;
    distinct: "DISTINCT" | null;
    orderby: OrderByAst[] | null;
    separator?: string | null;
    parentheses?: boolean;
  };
  over?: WindowOverAst | null;
};

export type FunctionAst = {
  type: "function";
  name: {
    schema?: AstValueExpr<string>;
    name: Array<AstIdentifierExpr | AstKeywordExpr>;
  };
  args?: ExprListAst;
  suffix?: unknown;
  separator?: string;
  over?: WindowOverAst | null;
};

export type ExtractAst = {
  type: "extract";
  args: {
    field: string;
    cast_type: string | null;
    source: ParserExprAst;
  };
};

export type CastAst = {
  type: "cast";
  keyword: "cast";
  expr: ParserExprAst;
  symbol: "as";
  target: Array<{ dataType: string; quoted?: string }>;
};

export type ArrayAst = {
  type: "array";
  keyword: "array";
  expr_list: ExprListAst;
  brackets: true;
};

export type CaseAst = {
  type: "case";
  expr: null;
  args: Array<
    | { type: "when"; cond: ParserExprAst; result: ParserExprAst }
    | { type: "else"; result: ParserExprAst }
  >;
};

export type ParserExprAst =
  | ColumnRefAst
  | LiteralAst
  | ParamAst
  | UnaryExprAst
  | BinaryExprAst
  | AggrFuncAst
  | FunctionAst
  | ExtractAst
  | CastAst
  | ExprListAst
  | ArrayAst
  | CaseAst;

export type SelectColumnAst = {
  expr: ParserExprAst;
  as: string | AstValueExpr<string> | null;
};

export type GroupByAst = {
  columns: ParserExprAst[] | null;
  modifiers: AstValueExpr<string>[];
};

export type StandardLimitAst = {
  seperator: string;
  value: Array<{ type: string; value: number }>;
};

type Db2LimitKeywordAst = {
  type: "origin";
  value: string;
};

type Db2LimitValueAst = {
  prefix: Db2LimitKeywordAst[];
  value: { type: "number"; value: number };
  suffix: Db2LimitKeywordAst[];
};

/** DB2's FETCH FIRST/NEXT representation used by node-sql-parser. */
export type Db2LimitAst = {
  offset?: Db2LimitValueAst;
  fetch: Db2LimitValueAst;
};

export type LimitAst = StandardLimitAst | Db2LimitAst;

export type TopAst = {
  value: number;
  percent: null;
  parentheses?: boolean;
};

export type SubqueryFromAst = {
  ast: Select | SelectAst;
  tableList?: [];
  columnList?: [];
  parentheses?: true;
};

export type BaseFromRef = {
  db?: string | null;
  schema?: string | null;
  table?: string;
  rawTable?: string | null;
  as: string | AstValueExpr<string> | null;
  rawAlias?: string | null;
  expr?: AstIdentifierExpr;
  type?: "expr";
};

export type JoinedFromAst = {
  join?: string;
  prefix?: string;
  on?: ParserExprAst;
};

export type TableFromAst = BaseFromRef & JoinedFromAst;

export type SubqueryFromRef = {
  expr: SubqueryFromAst;
  as?: string | null;
  parentheses?: boolean | { length: number };
} & JoinedFromAst;

export type FromAst = TableFromAst | SubqueryFromRef;

export type SelectAst = Omit<
  Select,
  "columns" | "from" | "where" | "groupby" | "having" | "qualify" | "orderby" | "limit" | "options" | "window"
> & {
  columns: SelectColumnAst[];
  from: FromAst[] | FromAst | null;
  where: ParserExprAst | null;
  groupby: GroupByAst | null;
  having: ParserExprAst | null;
  qualify?: ParserExprAst | null;
  orderby: OrderByAst[] | null;
  limit: LimitAst | null;
  top?: TopAst | null;
  options: unknown[] | null;
  window?: unknown;
  into?: { position: null };
  locking_read?: null;
  collate?: null;
};

export type ScopeBindings = Readonly<Partial<Record<ScopeId, string | null>>>;

export type SqlRenderContext = {
  mode: "sql" | "ast";
  dialect: import("../types.ts").QueryDialect | null;
  parameterMode: SqlParameterMode;
  parameterPrefix: SqlParameterPrefix;
  paramBindings: SqlParamBindings | undefined;
  params: SqlParam[];
  reservedParameterNames: ReadonlySet<string>;
  nextAutoParameterIndex: number;
  identifierBindings: Record<string, AstIdentifierExpr>;
  columnIdentifierBindings: Record<string, ColumnRefAst["column"]>;
  cteNameBindings: Partial<Record<InternalCteName, string>>;
  nextInternalCteIndex: number;
};
