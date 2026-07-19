/** SQL date literal represented independently of JavaScript `Date`. */
export type DateLiteral = Readonly<{ kind: "date_literal"; value: string }>;
/** SQL timestamp literal represented independently of JavaScript `Date`. */
export type TimestampLiteral = Readonly<{ kind: "timestamp_literal"; value: string }>;
/** SQL bigint literal represented as decimal text for JSON-compatible IR transport. */
export type BigIntLiteral = Readonly<{ kind: "bigint_literal"; value: string }>;
/** Primitive literal value accepted by the SQL IR. */
export type Value = string | number | boolean | null | DateLiteral | TimestampLiteral | BigIntLiteral;

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
  | "IN"
  | "NOT IN"
  | "BETWEEN"
  | "IS DISTINCT FROM";
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
  | BuiltinFuncNode
  | FuncNode
  | ListNode
  | ArrayNode
  | ExtractNode
  | CastNode
  | WindowNode
  | CaseNode
) & ExprNodeResult<T>;

/** Resolved column reference. */
export type ColumnNode = Readonly<{
  kind: "column";
  table: string | null;
  name: string;
}>;

/** Literal expression node. */
export type LiteralNode = Readonly<{
  kind: "literal";
  value: Value;
}>;

/** Parameter expression node. */
export type ParamNode = Readonly<{
  kind: "param";
  name: string;
}>;

/** Binary expression node. */
export type BinaryNode = Readonly<{
  kind: "binary";
  op: BinaryOp;
  left: ExprNode<unknown>;
  right: ExprNode<unknown>;
}>;

/** Unary expression node. */
export type UnaryNode = Readonly<{
  kind: "unary";
  op: UnaryOp;
  expr: ExprNode<unknown>;
}>;

/** Aggregate function expression node. */
export type AggNode = Readonly<{
  kind: "agg";
  name: AggFuncName;
  arg: ExprNode<unknown>;
  distinct: boolean;
}>;

/** Grouping marker used while lowering fold projections. */
export type GroupNode = Readonly<{
  kind: "group";
  expr: ExprNode<unknown>;
}>;

/** Portable scalar function call from Teta's built-in language catalog. */
export type BuiltinFuncNode = Readonly<{
  kind: "builtin";
  op: BuiltinFunctionOperation;
  args: readonly ExprNode<unknown>[];
}>;

/** Database-specific scalar function call expression node. */
export type FuncNode = Readonly<{
  kind: "func";
  name: string;
  args: readonly ExprNode<unknown>[];
}>;

/** SQL expression-list node. */
export type ListNode = Readonly<{
  kind: "list";
  items: readonly ExprNode<unknown>[];
}>;

/** SQL array expression node. */
export type ArrayNode = Readonly<{
  kind: "array";
  items: readonly ExprNode<unknown>[];
}>;

/** SQL `EXTRACT` expression node. */
export type ExtractNode = Readonly<{
  kind: "extract";
  field: string;
  source: ExprNode<unknown>;
}>;

/** SQL `CAST` expression node. */
export type CastNode = Readonly<{
  kind: "cast";
  expr: ExprNode<unknown>;
  target: string;
}>;

/** SQL window-function expression node. */
export type WindowNode = Readonly<{
  kind: "window";
  name: string;
  args: readonly ExprNode<unknown>[];
  partitionBy: readonly OrderExpr[] | null;
  orderBy: readonly OrderItem[] | null;
}>;

/** One branch of a SQL `CASE` expression. */
export type CaseWhenNode = Readonly<{
  when: ExprNode<boolean | null>;
  then: ExprNode<unknown>;
}>;

/** SQL `CASE WHEN ... THEN ... ELSE ... END` expression node. */
export type CaseNode = Readonly<{
  kind: "case";
  whens: readonly CaseWhenNode[];
  elseExpr: ExprNode<unknown> | null;
}>;

/** Expression accepted in an order or partition list. */
export type OrderExpr = ExprNode<unknown>;

/** Projection item with an optional output alias. */
export type ProjectionItem = Readonly<{ expr: ExprNode<unknown>; as: SqlIdentifier | null }>;
/** Sort expression and direction. */
export type OrderItem = Readonly<{ expr: ExprNode<unknown>; direction: "ASC" | "DESC" }>;

/** Normalized SQL identifier plus whether it should be quoted. */
export type SqlIdentifier<Name extends string = string> = Readonly<{
  name: Name;
  quoted: boolean;
}>;

/** User-facing identifier input accepted by IR helper utilities. */
export type IdentifierInput<Name extends string = string> =
  | Name
  | Readonly<{
      name: Name;
      quoted?: boolean;
    }>;
import type { BuiltinFunctionOperation } from "../language/spec.ts";
