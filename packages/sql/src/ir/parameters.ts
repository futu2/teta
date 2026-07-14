import type {
  CteSpec,
  ExprNode,
  ProjectionItem,
  QuerySpec,
  Stage,
} from "./types.ts";
import type { QueryIRSqlTarget } from "../renderer_types.ts";

/** Collect every explicit parameter name that may be emitted by a query target. */
export function collectQueryParameterNames(target: QueryIRSqlTarget): ReadonlySet<string> {
  const names = new Set<string>();
  collectQuerySpecParameterNames(target, names);
  for (const cte of target.withs ?? []) {
    collectCteParameterNames(cte, names);
  }
  return names;
}

/** Collect every explicit parameter name that may be emitted by an expression. */
export function collectExprParameterNames(expr: ExprNode<unknown>): ReadonlySet<string> {
  const names = new Set<string>();
  collectExprNames(expr, names);
  return names;
}

function collectQuerySpecParameterNames(query: QuerySpec, names: Set<string>): void {
  for (const stage of query.stages) {
    collectStageParameterNames(stage, names);
  }
}

function collectCteParameterNames(cte: CteSpec, names: Set<string>): void {
  if (cte.kind === "query") {
    collectQuerySpecParameterNames(cte.query, names);
    return;
  }
  collectQuerySpecParameterNames(cte.base, names);
  collectQuerySpecParameterNames(cte.step, names);
}

function collectStageParameterNames(stage: Stage, names: Set<string>): void {
  switch (stage.kind) {
    case "map":
      collectProjectionParameterNames(stage.items, names);
      return;
    case "fold":
      collectProjectionParameterNames(stage.items, names);
      for (const expr of stage.groupBy ?? []) collectExprNames(expr, names);
      return;
    case "filter":
      collectExprNames(stage.predicate, names);
      collectProjectionParameterNames(stage.projectAll, names);
      return;
    case "sort":
      for (const item of stage.items) collectExprNames(item.expr, names);
      collectProjectionParameterNames(stage.projectAll, names);
      return;
    case "take":
      collectProjectionParameterNames(stage.projectAll, names);
      return;
    case "join":
      collectExprNames(stage.on, names);
      collectProjectionParameterNames(stage.projectAll, names);
      if (stage.source.kind === "subquery") {
        collectQuerySpecParameterNames(stage.source.query, names);
      }
      return;
    case "unnest":
      collectExprNames(stage.expr, names);
      collectProjectionParameterNames(stage.projectAll, names);
      return;
    case "union":
      collectProjectionParameterNames(stage.projectAll, names);
      collectQuerySpecParameterNames(stage.right, names);
      return;
  }
}

function collectProjectionParameterNames(
  items: readonly ProjectionItem[],
  names: Set<string>
): void {
  for (const item of items) collectExprNames(item.expr, names);
}

function collectExprNames(expr: ExprNode<unknown>, names: Set<string>): void {
  switch (expr.kind) {
    case "column":
    case "literal":
      return;
    case "param":
      names.add(expr.name);
      return;
    case "binary":
      collectExprNames(expr.left, names);
      collectExprNames(expr.right, names);
      return;
    case "unary":
    case "group":
      collectExprNames(expr.expr, names);
      return;
    case "agg":
      collectExprNames(expr.arg, names);
      return;
    case "builtin":
    case "func":
      for (const arg of expr.args) collectExprNames(arg, names);
      return;
    case "list":
    case "array":
      for (const item of expr.items) collectExprNames(item, names);
      return;
    case "extract":
      collectExprNames(expr.source, names);
      return;
    case "cast":
      collectExprNames(expr.expr, names);
      return;
    case "window":
      for (const arg of expr.args) collectExprNames(arg, names);
      for (const item of expr.partitionBy ?? []) collectExprNames(item, names);
      for (const item of expr.orderBy ?? []) collectExprNames(item.expr, names);
      return;
    case "case":
      for (const branch of expr.whens) {
        collectExprNames(branch.when, names);
        collectExprNames(branch.then, names);
      }
      if (expr.elseExpr) collectExprNames(expr.elseExpr, names);
      return;
  }
}
