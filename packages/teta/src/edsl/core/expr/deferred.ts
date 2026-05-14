import type {
  DeferredColumnNode,
  DeferredColumnScope,
  ExprNode,
  OrderItem,
} from "../types.ts";
import { userError } from "../../errors.ts";
import { ExprRef, type ColumnRefs, type DeferredExprDepScope } from "./runtime.ts";
import type { ProjectionShape, ProjectionValue } from "./projection_types.ts";

type DeferredColumnDeps<
  TScope extends DeferredExprDepScope,
  TName extends string,
> = {
  [K in TScope]: Record<TName, unknown>;
};

type DeferredResolutionTarget = {
  label: string;
  columns: ColumnRefs<Record<string, any>>;
  columnNames: readonly string[];
};

type DeferredProjectionOptions = {
  requireExprValues?: boolean;
  label?: string;
};

export type DeferredResolutionScope = {
  current?: DeferredResolutionTarget;
  left?: DeferredResolutionTarget;
  right?: DeferredResolutionTarget;
};

export function col<const TName extends string>(
  name: TName
): ExprRef<never, DeferredColumnDeps<"current", TName>> {
  return deferredColumn("current", name) as ExprRef<never, DeferredColumnDeps<"current", TName>>;
}

export function leftCol<const TName extends string>(
  name: TName
): ExprRef<never, DeferredColumnDeps<"left", TName>> {
  return deferredColumn("left", name) as ExprRef<never, DeferredColumnDeps<"left", TName>>;
}

export function rightCol<const TName extends string>(
  name: TName
): ExprRef<never, DeferredColumnDeps<"right", TName>> {
  return deferredColumn("right", name) as ExprRef<never, DeferredColumnDeps<"right", TName>>;
}

export function resolveDeferredExpr<T>(
  expr: ExprRef<T>,
  scope: DeferredResolutionScope
): ExprRef<T> {
  if (!(expr instanceof ExprRef)) {
    invalidDeferredInput("expression", expr);
  }
  return new ExprRef<T>(resolveDeferredExprNode(expr.node, scope) as ExprNode<T>);
}

export function resolveDeferredOrderItem(
  item: OrderItem,
  scope: DeferredResolutionScope
): OrderItem {
  if (!isOrderItem(item)) {
    invalidDeferredInput("sort item", item);
  }
  return {
    ...item,
    expr: resolveDeferredExprNode(item.expr, scope),
  };
}

export function resolveDeferredProjectionShape<TSelection extends ProjectionShape>(
  selection: TSelection,
  scope: DeferredResolutionScope,
  options: DeferredProjectionOptions = {}
): TSelection {
  if (selection === null || typeof selection !== "object") {
    invalidDeferredInput(`${options.label ?? "projection"} shape`, selection);
  }
  if (Array.isArray(selection)) {
    return selection;
  }

  const resolved: Record<string, ProjectionValue> = {};
  for (const key of Object.keys(selection)) {
    const value = selection[key] as ProjectionValue;
    if (value instanceof ExprRef) {
      resolved[key] = resolveDeferredExpr(value, scope);
    } else if (options.requireExprValues) {
      userError(
        "DEFERRED_PROJECTION_INVALID",
        `${options.label ?? "Projection"} value '${key}' must be an expression`
      );
    } else {
      resolved[key] = value;
    }
  }
  return resolved as TSelection;
}

function deferredColumn<TScope extends DeferredColumnScope, TName extends string>(
  scope: TScope,
  name: TName
): ExprRef<any, DeferredColumnDeps<TScope, TName>> {
  return new ExprRef<any, DeferredColumnDeps<TScope, TName>>({
    kind: "deferred_column",
    scope,
    name,
  } as ExprNode<any>);
}

function resolveDeferredExprNode<T>(
  node: ExprNode<T>,
  scope: DeferredResolutionScope
): ExprNode<T> {
  if (!isExprNode(node)) {
    invalidDeferredInput("expression", node);
  }

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

function isExprNode(value: unknown): value is ExprNode<unknown> {
  return value !== null && typeof value === "object" && typeof (value as { kind?: unknown }).kind === "string";
}

function isOrderItem(value: unknown): value is OrderItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as { direction?: unknown; expr?: unknown };
  return (item.direction === "ASC" || item.direction === "DESC") && isExprNode(item.expr);
}

function invalidDeferredInput(label: string, value: unknown): never {
  userError(
    "DEFERRED_INPUT_INVALID",
    `Invalid deferred ${label}: ${formatInvalidDeferredValue(value)}`
  );
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

function formatInvalidDeferredValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  const type = typeof value;
  if (type === "string") return JSON.stringify(value);
  if (type === "number" || type === "boolean" || type === "bigint") return String(value);
  if (type === "function") return "function";
  if (Array.isArray(value)) return "array";
  return "object";
}
