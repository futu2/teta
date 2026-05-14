/** SQL date literal represented independently of JavaScript `Date`. */
export type DateLiteral = { kind: "date_literal"; value: string };
/** SQL timestamp literal represented independently of JavaScript `Date`. */
export type TimestampLiteral = { kind: "timestamp_literal"; value: string };
/** Primitive literal value accepted by the SQL IR. */
export type Value = string | number | bigint | boolean | null | DateLiteral | TimestampLiteral;

/** Binary operator supported by expression IR nodes. */
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
/** Unary operator supported by expression IR nodes. */
export type UnaryOp = "NOT";
/** Built-in aggregate function names. */
export type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "ARRAY_AGG";
/** Aggregate function name, including custom dialect-specific names. */
export type AggFuncName = AggFunc | (string & {});
/** Canonical SQL join type used in the IR. */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
/** Join type accepted before normalization. */
export type JoinTypeInput = "inner" | "left" | "right" | "full" | JoinType;

type ExprNodeResult<T> = {
  readonly __valueType?: T;
};

/** Typed SQL expression node used by Teta frontends and the renderer. */
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
  | DeferredColumnNode
) & ExprNodeResult<T>;

/** Deferred column scope used before frontend column refs are resolved. */
export type DeferredColumnScope = "current" | "left" | "right";

/** Unresolved column reference produced by frontend deferred-column helpers. */
export type DeferredColumnNode = {
  kind: "deferred_column";
  scope: DeferredColumnScope;
  name: string;
};

/** Resolved column reference. */
export type ColumnNode = {
  kind: "column";
  table: string | null;
  name: string;
};

/** Literal expression node. */
export type LiteralNode = {
  kind: "literal";
  value: Value;
};

/** Parameter expression node. */
export type ParamNode = {
  kind: "param";
  value: unknown;
  name: string | null;
};

/** Binary expression node. */
export type BinaryNode = {
  kind: "binary";
  op: BinaryOp;
  left: ExprNode<any>;
  right: ExprNode<any>;
};

/** Unary expression node. */
export type UnaryNode = {
  kind: "unary";
  op: UnaryOp;
  expr: ExprNode<any>;
};

/** Aggregate function expression node. */
export type AggNode = {
  kind: "agg";
  name: AggFuncName;
  arg: ExprNode<any>;
  distinct: boolean;
};

/** Grouping marker used while lowering fold projections. */
export type GroupNode = {
  kind: "group";
  expr: ExprNode<any>;
};

/** Scalar function call expression node. */
export type FuncNode = {
  kind: "func";
  name: string;
  args: ExprNode<any>[];
};

/** SQL expression-list node. */
export type ListNode = {
  kind: "list";
  items: ExprNode<any>[];
};

/** SQL array expression node. */
export type ArrayNode = {
  kind: "array";
  items: ExprNode<any>[];
};

/** SQL `EXTRACT` expression node. */
export type ExtractNode = {
  kind: "extract";
  field: string;
  source: ExprNode<any>;
};

/** SQL `CAST` expression node. */
export type CastNode = {
  kind: "cast";
  expr: ExprNode<any>;
  target: string;
};

/** SQL window-function expression node. */
export type WindowNode = {
  kind: "window";
  name: string;
  args: ExprNode<any>[];
  partitionBy: OrderExpr[] | null;
  orderBy: OrderItem[] | null;
};

/** One branch of a SQL `CASE` expression. */
export type CaseWhenNode = {
  when: ExprNode<boolean>;
  then: ExprNode<any>;
};

/** SQL `CASE WHEN ... THEN ... ELSE ... END` expression node. */
export type CaseNode = {
  kind: "case";
  whens: CaseWhenNode[];
  elseExpr: ExprNode<any> | null;
};

/** Expression accepted in an order or partition list. */
export type OrderExpr = ExprNode<any>;

/** Projection item with an optional output alias. */
export type ProjectionItem = { expr: ExprNode<any>; as: SqlIdentifier | null };
/** Sort expression and direction. */
export type OrderItem = { expr: ExprNode<any>; direction: "ASC" | "DESC" };

/** Normalized SQL identifier plus whether it should be quoted. */
export type SqlIdentifier<Name extends string = string> = {
  name: Name;
  quoted: boolean;
};

/** User-facing identifier input accepted by IR helper utilities. */
export type IdentifierInput<Name extends string = string> =
  | Name
  | {
      name: Name;
      quoted?: boolean;
    };
