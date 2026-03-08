export const OUTER_TABLE_ALIAS = "__teta_outer__";
export const INTERNAL_SCOPE_PREFIX = "__teta_scope_";

export function isInternalScopeName(value: string | null): boolean {
  return value !== null && value.startsWith(INTERNAL_SCOPE_PREFIX);
}

export type DateLiteral = { kind: "date_literal"; value: string };
export type TimestampLiteral = { kind: "timestamp_literal"; value: string };
export type Value = string | number | boolean | null | DateLiteral | TimestampLiteral;

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
  | "||"
  | "LIKE"
  | "IS"
  | "IS NOT"
  | "IN";
export type UnaryOp = "NOT";
export type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
export type JoinTypeInput = "inner" | "left" | "right" | "full" | JoinType;

export type ExprNode<T> =
  | ColumnNode
  | LiteralNode
  | BinaryNode
  | UnaryNode
  | AggNode
  | GroupNode
  | FuncNode
  | ListNode
  | ArrayNode
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

export type ArrayNode = {
  kind: "array";
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

export type SelectItem = { expr: ExprNode<any>; as: SqlIdentifier | null };
export type OrderItem = { expr: ExprNode<any>; direction: "ASC" | "DESC" };

export type SqlIdentifier<Name extends string = string> = {
  name: Name;
  quoted: boolean;
};

export type IdentifierInput<Name extends string = string> =
  | Name
  | {
      name: Name;
      quoted?: boolean;
    };

export type StructuredTableSource = {
  db: SqlIdentifier | null;
  schema: SqlIdentifier | null;
  table: SqlIdentifier;
  as: SqlIdentifier | null;
};

export type TableSourceInput =
  | string
  | {
      table: IdentifierInput;
      schema?: IdentifierInput | null;
      db?: IdentifierInput | null;
      as?: IdentifierInput | null;
    }
  | {
      path:
        | readonly [IdentifierInput]
        | readonly [IdentifierInput, IdentifierInput]
        | readonly [IdentifierInput, IdentifierInput, IdentifierInput];
      as?: IdentifierInput | null;
    };

export type Source = StructuredTableSource;
export type SourceRef =
  | {
      kind: "table";
      db: SqlIdentifier | null;
      name: SqlIdentifier;
      schema: SqlIdentifier | null;
      as: SqlIdentifier | null;
      columnIdentifiers?: Readonly<Record<string, SqlIdentifier>> | null;
    }
  | { kind: "cte"; name: string; columnIdentifiers?: Readonly<Record<string, SqlIdentifier>> | null; };

export type QuerySpec = {
  source: Source;
  stages: Stage[];
  columnNames: readonly string[] | null;
  columnIdentifiers: Readonly<Record<string, SqlIdentifier>> | null;
  scopeId: string;
};

export type JoinSource =
  | {
      kind: "table";
      db: SqlIdentifier | null;
      table: SqlIdentifier;
      schema: SqlIdentifier | null;
      columnIdentifiers?: Readonly<Record<string, SqlIdentifier>> | null;
    }
  | {
      kind: "subquery";
      query: QuerySpec;
      inheritedBindings: Readonly<Record<string, string | null>> | null;
    };

export type Stage =
  | {
      kind: "select";
      items: SelectItem[];
      keys: string[];
      groupBy: ExprNode<any>[] | null;
      outputScopeId: string;
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
      rightScopeId: string;
      outputScopeId: string;
    }
  | {
      kind: "union";
      op: "union" | "union all";
      right: QuerySpec;
      selectAll: SelectItem[];
      outputScopeId: string;
    };

export type QueryIR = {
  source: Source;
  stages: Stage[];
  scopeId: string;
};

export type CteSpec =
  | { kind: "query"; name: string; query: QuerySpec }
  | {
      kind: "recursive";
      name: string;
      columnNames: readonly string[];
      base: QuerySpec;
      step: QuerySpec;
    };

export type ColumnType<T> = { kind: "column_type"; _type?: T };

export type InferSchema<S extends Record<string, ColumnType<any>>> = {
  [K in keyof S]: S[K] extends ColumnType<infer T> ? T : never;
};
