import { filterResolved } from "./builder.ts";
import type { Query, QueryStep } from "./builder.ts";
import type { ExprNode } from "../core/types.ts";
import type {
  ColumnRefs,
  ExprInput,
} from "../expr.ts";
import { ExprRef, eq, ne, gt, gte, lt, lte } from "../expr.ts";
import type { NormalizeNumericLiteral, SqlDate, SqlNumber, SqlTimestamp } from "../sql/types.ts";
import type { QueryColumns } from "./deferred_types.ts";
import { userError } from "../errors.ts";

type ComparableInput = SqlNumber | number | bigint | SqlDate | SqlTimestamp | null;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type NotFunction<T> = IsAny<T> extends true
  ? never
  : T extends (...args: any[]) => any
    ? never
    : unknown;
type DirectOperand<TValue> = ExprInput<TValue>;
type CallableOperand<TColumns extends QueryColumns, TValue> =
  (cols: ColumnRefs<TColumns>) => ExprInput<TValue>;
type Operand<TColumns extends QueryColumns, TValue> =
  | DirectOperand<TValue>
  | CallableOperand<TColumns, TValue>;
type ExprInputValueOf<TExpr> =
  TExpr extends ExprRef<infer TValue, any> ? TValue
  : TExpr extends ExprInput<infer TValue> ? TValue
  : never;
type WidenLiteral<T> =
  T extends string ? string
  : T extends number ? number
  : T extends bigint ? bigint
  : T extends boolean ? boolean
  : T;
type NonNullWidenLiteral<T> = WidenLiteral<Exclude<T, null>>;
type SameComparableValue<TLeft, TRight> =
  [NonNullWidenLiteral<TLeft>] extends [NonNullWidenLiteral<TRight>]
    ? [NonNullWidenLiteral<TRight>] extends [NonNullWidenLiteral<TLeft>]
      ? unknown
      : never
    : never;
type NormalizeComparableLiteral<TLeft, TRight> =
  NormalizeNumericLiteral<ExprInputValueOf<TLeft>, ExprInputValueOf<TRight>>;
type CompatibleExprInputValue<TLeft extends ExprInput<unknown>, TRight extends ExprInput<unknown>> =
  SameComparableValue<
    ExprInputValueOf<TLeft>,
    NormalizeComparableLiteral<TLeft, TRight>
  >;
type SameExprInputValue<TLeft extends ExprInput<unknown>, TRight extends ExprInput<unknown>> =
  CompatibleExprInputValue<TLeft, TRight> extends never
    ? CompatibleExprInputValue<TRight, TLeft>
    : CompatibleExprInputValue<TLeft, TRight>;
type SameExprInputValueRest<TLeft extends ExprInput<unknown>, TRight extends ExprInput<unknown>> =
  SameExprInputValue<TLeft, TRight> extends never ? [never] : [];
type ComparableExprInput<TInput extends ExprInput<unknown>> =
  Exclude<ExprInputValueOf<TInput>, null> extends ComparableInput ? unknown : never;
type ComparableExprInputRest<TInput extends ExprInput<unknown>> =
  ComparableExprInput<TInput> extends never ? [never] : [];

export function filterEq<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<unknown>,
  TRight extends ExprInput<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterEq<TColumns extends QueryColumns, T, TRight extends ExprInput<NoInfer<T>>>(
  left: CallableOperand<TColumns, T>,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterEq<TColumns extends QueryColumns, T, TLeft extends ExprInput<T>>(
  left: TLeft & NotFunction<TLeft>,
  right: CallableOperand<TColumns, NoInfer<T>>
): QueryStep<TColumns, TColumns>;

export function filterEq<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterEq<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, eq);
}

export function filterNe<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<unknown>,
  TRight extends ExprInput<unknown>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterNe<TColumns extends QueryColumns, T, TRight extends ExprInput<NoInfer<T>>>(
  left: CallableOperand<TColumns, T>,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterNe<TColumns extends QueryColumns, T, TLeft extends ExprInput<T>>(
  left: TLeft & NotFunction<TLeft>,
  right: CallableOperand<TColumns, NoInfer<T>>
): QueryStep<TColumns, TColumns>;

export function filterNe<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterNe<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, ne);
}

export function filterGt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterGt<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<T>,
  TRight extends ExprInput<NoInfer<T>>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterGt<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<NoInfer<T>>,
  TRight extends ExprInput<T>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): QueryStep<TColumns, TColumns>;

export function filterGt<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterGt<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, gt);
}

export function filterGte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterGte<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<T>,
  TRight extends ExprInput<NoInfer<T>>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterGte<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<NoInfer<T>>,
  TRight extends ExprInput<T>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): QueryStep<TColumns, TColumns>;

export function filterGte<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterGte<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, gte);
}

export function filterLt<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterLt<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<T>,
  TRight extends ExprInput<NoInfer<T>>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterLt<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<NoInfer<T>>,
  TRight extends ExprInput<T>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): QueryStep<TColumns, TColumns>;

export function filterLt<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterLt<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, lt);
}

export function filterLte<
  TColumns extends QueryColumns,
  TLeft extends ExprInput<ComparableInput>,
  TRight extends ExprInput<ComparableInput>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: (cols: ColumnRefs<TColumns>) => TRight,
  ...guard: SameExprInputValueRest<TLeft, TRight>
): QueryStep<TColumns, TColumns>;

export function filterLte<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<T>,
  TRight extends ExprInput<NoInfer<T>>,
>(
  left: (cols: ColumnRefs<TColumns>) => TLeft,
  right: TRight & NotFunction<TRight>
): QueryStep<TColumns, TColumns>;

export function filterLte<
  TColumns extends QueryColumns,
  T extends ComparableInput,
  TLeft extends ExprInput<NoInfer<T>>,
  TRight extends ExprInput<T>,
>(
  left: TLeft & NotFunction<TLeft>,
  right: (cols: ColumnRefs<TColumns>) => TRight
): QueryStep<TColumns, TColumns>;

export function filterLte<TLeft extends DirectOperand<unknown>, TRight extends DirectOperand<unknown>>(
  left: TLeft & NotFunction<TLeft>,
  right: TRight & NotFunction<TRight>,
  ...guard: [
    ...SameExprInputValueRest<TLeft, TRight>,
    ...ComparableExprInputRest<TLeft>,
    ...ComparableExprInputRest<TRight>,
  ]
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<TColumns>;

export function filterLte<TColumns extends QueryColumns, T extends ComparableInput>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>
): QueryStep<TColumns, TColumns> {
  return comparisonFilter(left, right, lte);
}

function comparisonFilter<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>,
  op: (left: ExprInput<T>, right: ExprInput<T>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns> {
  return (query: Query<TColumns>) => {
    const resolvedLeft = resolveOperand(query, left);
    const resolvedRight = resolveOperand(query, right);
    return filterResolved<TColumns>(op(resolvedLeft, resolvedRight))(query);
  };
}

function resolveOperand<TColumns extends QueryColumns, T>(
  query: Query<TColumns>,
  operand: Operand<TColumns, T>
): ExprInput<T> {
  const resolved = isCallableOperand(operand)
    ? operand(query.columns)
    : operand;
  rejectDeferredOperand(resolved);
  return resolved;
}

function isCallableOperand<TColumns extends QueryColumns, T>(
  operand: Operand<TColumns, T>
): operand is CallableOperand<TColumns, T> {
  return typeof operand === "function";
}

function rejectDeferredOperand(operand: ExprInput<unknown>): void {
  if (!(operand instanceof ExprRef)) return;
  const node = validateOperandNode(operand.node);
  if (containsDeferredColumn(node)) {
    userError(
      "QUERY_FILTER_DEFERRED_OPERAND",
      "Comparison filter helpers no longer accept deferred col() operands. Use a row callback instead."
    );
  }
}

function validateOperandNode(node: unknown): ExprNode<unknown> {
  if (node === null || typeof node !== "object") {
    invalidExpressionOperand();
  }
  const kind = (node as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !isKnownExprNodeKind(kind)) {
    invalidExpressionOperand();
  }
  return node as ExprNode<unknown>;
}

function invalidExpressionOperand(): never {
  userError(
    "QUERY_FILTER_INVALID_OPERAND",
    "Comparison filter helpers received an invalid expression operand."
  );
}

function isKnownExprNodeKind(kind: string): boolean {
  return kind === "column"
    || kind === "literal"
    || kind === "param"
    || kind === "binary"
    || kind === "unary"
    || kind === "agg"
    || kind === "group"
    || kind === "func"
    || kind === "list"
    || kind === "array"
    || kind === "extract"
    || kind === "cast"
    || kind === "window"
    || kind === "case"
    || kind === "deferred_column";
}

function containsDeferredColumn(node: ExprNode<unknown>): boolean {
  switch (node.kind) {
    case "deferred_column":
      return true;
    case "binary":
      return containsDeferredColumn(node.left) || containsDeferredColumn(node.right);
    case "unary":
    case "group":
    case "cast":
      return containsDeferredColumn(node.expr);
    case "agg":
      return containsDeferredColumn(node.arg);
    case "func":
      return node.args.some((arg) => containsDeferredColumn(arg));
    case "list":
    case "array":
      return node.items.some((item) => containsDeferredColumn(item));
    case "extract":
      return containsDeferredColumn(node.source);
    case "window":
      return node.args.some((arg) => containsDeferredColumn(arg))
        || (node.partitionBy?.some((item) => containsDeferredColumn(item)) ?? false)
        || (node.orderBy?.some((item) => containsDeferredColumn(item.expr)) ?? false);
    case "case":
      return node.whens.some((branch) =>
        containsDeferredColumn(branch.when) || containsDeferredColumn(branch.then)
      ) || (node.elseExpr ? containsDeferredColumn(node.elseExpr) : false);
    case "column":
    case "literal":
    case "param":
      return false;
  }
}
