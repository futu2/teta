import type {
  DeferredColumnNode,
  DeferredColumnScope,
  ExprNode,
  OrderItem,
} from "../types.ts";
import { userError } from "../../errors.ts";
import { ColumnRef, ExprRef, type ColumnRefs } from "./runtime.ts";
import type { ProjectionShape, ProjectionValue } from "./projection_types.ts";

type DeferredRowProxy = {
  readonly [columnName: string]: ExprRef<any>;
};

type DeferredResolutionTarget = {
  label: string;
  columns: ColumnRefs<Record<string, any>>;
  columnNames: readonly string[];
};

export type DeferredResolutionScope = {
  current?: DeferredResolutionTarget;
  left?: DeferredResolutionTarget;
  right?: DeferredResolutionTarget;
};

export const $ = createDeferredRowProxy("current");
export const $left = createDeferredRowProxy("left");
export const $right = createDeferredRowProxy("right");

export function pickCols<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  cols: ColumnRefs<TColumns>
) => { [K in TNames[number]]: ColumnRef<TColumns[K], K> } {
  return function pickSelectedColumns<TColumns extends Record<TNames[number], any>>(
    cols: ColumnRefs<TColumns>
  ): { [K in TNames[number]]: ColumnRef<TColumns[K], K> } {
    const result: Partial<{ [K in TNames[number]]: ColumnRef<TColumns[K], K> }> = {};
    for (const name of names) {
      const key = name as TNames[number];
      if (!(name in cols)) {
        userError(
          "DEFERRED_COLUMN_UNKNOWN",
          `Unknown current row column '${name}'. Available columns: ${Object.keys(cols).join(", ")}`
        );
      }
      result[key] = Reflect.get(cols, name) as ColumnRef<TColumns[typeof key], typeof key>;
    }
    return result as { [K in TNames[number]]: ColumnRef<TColumns[K], K> };
  };
}

export function resolveDeferredExpr<T>(
  expr: ExprRef<T>,
  scope: DeferredResolutionScope
): ExprRef<T> {
  return new ExprRef<T>(resolveDeferredExprNode(expr.node, scope) as ExprNode<T>);
}

export function resolveDeferredOrderItem(
  item: OrderItem,
  scope: DeferredResolutionScope
): OrderItem {
  return {
    ...item,
    expr: resolveDeferredExprNode(item.expr, scope),
  };
}

export function resolveDeferredProjectionShape<TSelection extends ProjectionShape>(
  selection: TSelection,
  scope: DeferredResolutionScope
): TSelection {
  const resolved: Record<string, ProjectionValue> = {};
  for (const key of Object.keys(selection)) {
    const value = selection[key] as ProjectionValue;
    resolved[key] = value instanceof ExprRef ? resolveDeferredExpr(value, scope) : value;
  }
  return resolved as TSelection;
}

function createDeferredRowProxy(scope: DeferredColumnScope): DeferredRowProxy {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "then") return undefined;
        return deferredColumn(scope, prop);
      },
    }
  ) as DeferredRowProxy;
}

function deferredColumn(scope: DeferredColumnScope, name: string): ExprRef<any> {
  return new ExprRef<any>({
    kind: "deferred_column",
    scope,
    name,
  } as ExprNode<any>);
}

function resolveDeferredExprNode<T>(
  node: ExprNode<T>,
  scope: DeferredResolutionScope
): ExprNode<T> {
  switch (node.kind) {
    case "deferred_column":
      return resolveDeferredColumnNode(node, scope) as ExprNode<T>;
    case "binary":
      return {
        ...node,
        left: resolveDeferredExprNode(node.left, scope),
        right: resolveDeferredExprNode(node.right, scope),
      } as ExprNode<T>;
    case "unary":
      return {
        ...node,
        expr: resolveDeferredExprNode(node.expr, scope),
      } as ExprNode<T>;
    case "agg":
      return {
        ...node,
        arg: resolveDeferredExprNode(node.arg, scope),
      } as ExprNode<T>;
    case "group":
      return {
        ...node,
        expr: resolveDeferredExprNode(node.expr, scope),
      } as ExprNode<T>;
    case "func":
      return {
        ...node,
        args: node.args.map((arg) => resolveDeferredExprNode(arg, scope)),
      } as ExprNode<T>;
    case "list":
      return {
        ...node,
        items: node.items.map((item) => resolveDeferredExprNode(item, scope)),
      } as ExprNode<T>;
    case "array":
      return {
        ...node,
        items: node.items.map((item) => resolveDeferredExprNode(item, scope)),
      } as ExprNode<T>;
    case "extract":
      return {
        ...node,
        source: resolveDeferredExprNode(node.source, scope),
      } as ExprNode<T>;
    case "cast":
      return {
        ...node,
        expr: resolveDeferredExprNode(node.expr, scope),
      } as ExprNode<T>;
    case "window":
      return {
        ...node,
        args: node.args.map((arg) => resolveDeferredExprNode(arg, scope)),
        partitionBy: node.partitionBy?.map((item) => resolveDeferredExprNode(item, scope)) ?? null,
        orderBy: node.orderBy?.map((item) => resolveDeferredOrderItem(item, scope)) ?? null,
      } as ExprNode<T>;
    case "case":
      return {
        ...node,
        whens: node.whens.map((branch) => ({
          when: resolveDeferredExprNode(branch.when, scope) as ExprNode<boolean>,
          then: resolveDeferredExprNode(branch.then, scope),
        })),
        elseExpr: node.elseExpr ? resolveDeferredExprNode(node.elseExpr, scope) : null,
      } as ExprNode<T>;
    case "column":
    case "literal":
    case "param":
      return node;
  }
}

function resolveDeferredColumnNode(
  node: DeferredColumnNode,
  scope: DeferredResolutionScope
): ExprNode<any> {
  const target = scope[node.scope];
  if (!target) {
    userError(
      "DEFERRED_COLUMN_SCOPE",
      `${deferredScopeLabel(node.scope)} column '${node.name}' cannot be resolved in this query helper`
    );
  }

  if (!target.columnNames.includes(node.name)) {
    userError(
      "DEFERRED_COLUMN_UNKNOWN",
      `Unknown ${target.label} column '${node.name}'. Available columns: ${formatColumnNames(target.columnNames)}`
    );
  }

  const value = Reflect.get(target.columns, node.name);
  if (!(value instanceof ExprRef)) {
    userError(
      "DEFERRED_COLUMN_UNKNOWN",
      `Unknown ${target.label} column '${node.name}'. Available columns: ${formatColumnNames(target.columnNames)}`
    );
  }
  return value.node;
}

function deferredScopeLabel(scope: DeferredColumnScope): string {
  switch (scope) {
    case "current":
      return "Current row";
    case "left":
      return "Join left";
    case "right":
      return "Join right";
  }
}

function formatColumnNames(columnNames: readonly string[]): string {
  return columnNames.length ? columnNames.join(", ") : "(none)";
}
