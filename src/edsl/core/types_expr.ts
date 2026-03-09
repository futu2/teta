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

type ExprNodeResult<T> = {
  readonly __valueType?: never & T;
};

export type ExprNode<T> = (
  | ColumnNode
  | LiteralNode
  | ParamNode
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
  | CaseNode
) & ExprNodeResult<T>;

export type ColumnNode = {
  kind: "column";
  table: string | null;
  name: string;
};

export type LiteralNode = {
  kind: "literal";
  value: Value;
};

export type ParamNode = {
  kind: "param";
  value: unknown;
  name: string | null;
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
