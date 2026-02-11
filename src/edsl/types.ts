import type { AST, Option } from "node-sql-parser";

export const OUTER_TABLE_ALIAS = "__teta_outer__";

export type DateLiteral = { kind: "date_literal"; value: string };
export type TimestampLiteral = { kind: "timestamp_literal"; value: string };
export type Value = string | number | boolean | null | DateLiteral | TimestampLiteral;
declare const __sqlInt: unique symbol;
declare const __sqlFloat: unique symbol;

/** SQL integer numeric type. */
export type SqlInt = number & { readonly [__sqlInt]: true };
/** SQL floating-point numeric type. */
export type SqlFloat = number & { readonly [__sqlFloat]: true };
/** SQL numeric type (int or float). */
export type SqlNumber = SqlInt | SqlFloat;
/** SQL DATE value string. */
export type SqlDate = string;
/** SQL TIMESTAMP value string. */
export type SqlTimestamp = string;

export type BinaryOp =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "AND"
  | "OR"
  | "+"
  | "-"
  | "*"
  | "/"
  | "LIKE"
  | "IS"
  | "IS NOT"
  | "IN";
export type UnaryOp = "NOT";
export type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
export type JoinTypeInput = "inner" | "left" | "right" | "full" | JoinType;
/** Built-in SQL dialect identifiers supported by Teta. */
export type BuiltinDialect =
  | "MySQL"
  | "MariaDB"
  | "Postgresql"
  | "SQLite"
  | "Trino"
  | "TransactSQL"
  | "Redshift"
  | "Snowflake"
  | "BigQuery"
  | "Athena"
  | "DB2"
  | "Hive"
  | "FlinkSQL"
  | "NoQL"
  | "HetuEngineDQL"
  | "HetuEngine DQL"
  | "HetuEngine"
  | "mysql"
  | "mariadb"
  | "postgresql"
  | "sqlite"
  | "trino"
  | "transactsql"
  | "redshift"
  | "snowflake"
  | "bigquery"
  | "athena"
  | "db2"
  | "hive"
  | "flinksql"
  | "noql"
  | "hetuenginedql"
  | "hetuengine dql"
  | "hetuengine";

/** Dialect feature flags used during EDSL -> AST codegen. */
export type DialectFeatures = {
  lateralJoinKeyword?: boolean;
  recursiveCte?: boolean;
};

export type DialectLanguageFallback =
  | "bit_length_via_length_x8"
  | "array_length_via_json_array_length"
  | "array_length_dim1"
  | "array_contains_via_array_position"
  | "array_contains_via_json_instr"
  | "array_position_via_json_instr"
  | "array_join_via_json_string"
  | "array_append_via_json_insert_end"
  | "date_format_via_strftime"
  | "date_parse_via_datetime"
  | "date_trunc_via_strftime"
  | "date_add_via_datetime"
  | "date_diff_via_julianday"
  | "date_diff_via_extract_epoch"
  | "date_add_via_epoch_timestamp"
  | "to_unixtime_via_strftime_s"
  | "to_unixtime_via_extract_epoch"
  | "from_unixtime_via_datetime"
  | "regex_like_via_regexp_match"
  | "regex_like_via_regexp_function";

export type DialectLanguageConfig = {
  functions?: Record<string, string>;
  fallbacks?: Record<string, DialectLanguageFallback>;
  unsupported?: string[];
};

/** Custom dialect definition with optional parser fallback. */
export type DialectSpec = {
  name: string;
  parserDialect?: string | null;
  features?: DialectFeatures;
  language?: DialectLanguageConfig;
};

/** Database dialect identifier for SQL rendering and AST generation. */
export type Dialect = BuiltinDialect | DialectSpec | (string & {});

/** Resolved dialect configuration embedded in query IR and AST codegen. */
export type QueryDialect = {
  name: string;
  parserDialect: string | null;
  features: {
    lateralJoinKeyword: boolean;
    recursiveCte: boolean;
  };
  language: {
    functions: Record<string, string>;
    fallbacks: Record<string, DialectLanguageFallback>;
    unsupported: string[];
  };
};
/** SQL output formatting style. */
export type SqlFormat = "compact" | "pretty";
/** SQL parser options with optional formatting. */
export type SqlOptions = Option & { format?: SqlFormat; dialect?: Dialect };

export type ExprNode<T> =
  | ColumnNode
  | LiteralNode
  | BinaryNode
  | UnaryNode
  | AggNode
  | GroupNode
  | FuncNode
  | ListNode
  | ExtractNode
  | CastNode
  | WindowNode
  | CaseNode;

export type ColumnNode = {
  kind: "column";
  table: string | null;
  name: string;
};

export type LiteralNode = {
  kind: "literal";
  value: Value;
};

export type BinaryNode = {
  kind: "binary";
  op: BinaryOp;
  left: ExprNode<any>;
  right: ExprNode<any>;
};

export type UnaryNode = {
  kind: "unary";
  op: UnaryOp;
  expr: ExprNode<any>;
};

export type AggNode = {
  kind: "agg";
  name: AggFunc;
  arg: ExprNode<any>;
  distinct: boolean;
};

export type GroupNode = {
  kind: "group";
  expr: ExprNode<any>;
};

export type FuncNode = {
  kind: "func";
  name: string;
  args: ExprNode<any>[];
};

export type ListNode = {
  kind: "list";
  items: ExprNode<any>[];
};

export type ExtractNode = {
  kind: "extract";
  field: string;
  source: ExprNode<any>;
};

export type CastNode = {
  kind: "cast";
  expr: ExprNode<any>;
  target: string;
};

export type WindowNode = {
  kind: "window";
  name: string;
  args: ExprNode<any>[];
  partitionBy: OrderExpr[] | null;
  orderBy: OrderItem[] | null;
};

export type CaseWhenNode = {
  when: ExprNode<boolean>;
  then: ExprNode<any>;
};

export type CaseNode = {
  kind: "case";
  whens: CaseWhenNode[];
  elseExpr: ExprNode<any> | null;
};

export type OrderExpr = ExprNode<any>;

export type SelectItem = { expr: ExprNode<any>; as: string | null };
export type OrderItem = { expr: ExprNode<any>; direction: "ASC" | "DESC" };

export type Source = { table: string; schema: string | null; as: string | null };
export type SourceRef =
  | { kind: "table"; name: string; schema: string | null; as: string | null }
  | { kind: "cte"; name: string };

export type Stage =
  | {
      kind: "select";
      items: SelectItem[];
      keys: string[];
      groupBy: ExprNode<any>[] | null;
    }
  | { kind: "filter"; predicate: ExprNode<boolean>; selectAll: SelectItem[] }
  | { kind: "orderBy"; items: OrderItem[]; selectAll: SelectItem[] }
  | { kind: "limit"; count: number; selectAll: SelectItem[] }
  | {
      kind: "join";
      joinType: JoinType;
      lateral?: boolean;
      source: JoinSource;
      as: string | null;
      on: ExprNode<boolean>;
      selectAll: SelectItem[];
    }
  | {
      kind: "union";
      op: "union" | "union all";
      right: QuerySpec;
      selectAll: SelectItem[];
    };

export type JoinSource =
  | { kind: "table"; table: string; schema: string | null }
  | { kind: "subquery"; ast: AST };

export type QueryIR = {
  source: Source;
  stages: Stage[];
};

export type QuerySpec = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[] | null;
};

export type ColumnType<T> = { kind: "column_type"; _type?: T };

export type InferSchema<S extends Record<string, ColumnType<any>>> = {
  [K in keyof S]: S[K] extends ColumnType<infer T> ? T : never;
};
