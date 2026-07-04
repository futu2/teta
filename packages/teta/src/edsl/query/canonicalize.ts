import type {
  CteSpec,
  ExprNode,
  InternalCteName,
  ProjectionItem,
  QuerySpec,
  ScopeId,
  Source,
  Stage,
} from "../core/types.ts";
import type { QueryIR } from "./render.ts";

type QueryColumns = Record<string, any>;
type ScopeRewriteMap = Map<string, ScopeId>;
type CteRewriteMap = Map<string, InternalCteName>;

type CanonicalizeContext = {
  scopes: ScopeRewriteMap;
  ctes: CteRewriteMap;
  nextScopeIndex: number;
  nextCteIndex: number;
};

export function canonicalizeIR<TColumns extends QueryColumns>(
  ir: QueryIR<TColumns>
): QueryIR<TColumns> {
  const context: CanonicalizeContext = {
    scopes: new Map(),
    ctes: new Map(),
    nextScopeIndex: 0,
    nextCteIndex: 0,
  };

  return {
    ...ir,
    source: rewriteSource(ir.source, context),
    scopeId: rewriteScopeId(ir.scopeId, context),
    stages: ir.stages.map((stage) => rewriteStage(stage, context)),
    withs: ir.withs?.map((cte) => rewriteCte(cte, context)) ?? [],
  };
}

function rewriteQuerySpec(spec: QuerySpec, context: CanonicalizeContext): QuerySpec {
  return {
    ...spec,
    source: rewriteSource(spec.source, context),
    scopeId: rewriteScopeId(spec.scopeId, context),
    stages: spec.stages.map((stage) => rewriteStage(stage, context)),
  };
}

function rewriteCte(cte: CteSpec, context: CanonicalizeContext): CteSpec {
  switch (cte.kind) {
    case "query":
      return {
        ...cte,
        query: rewriteQuerySpec(cte.query, context),
      };
    case "recursive":
      return {
        ...cte,
        name: rewriteInternalCteName(cte.name, context),
        base: rewriteQuerySpec(cte.base, context),
        step: rewriteQuerySpec(cte.step, context),
      };
  }
}

function rewriteStage(stage: Stage, context: CanonicalizeContext): Stage {
  switch (stage.kind) {
    case "map":
      return {
        ...stage,
        items: stage.items.map((item) => rewriteProjectionItem(item, context)),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "fold":
      return {
        ...stage,
        items: stage.items.map((item) => rewriteProjectionItem(item, context)),
        groupBy: stage.groupBy?.map((expr) => rewriteExprNode(expr, context)) ?? null,
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "filter":
      return {
        ...stage,
        predicate: rewriteExprNode(stage.predicate, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "sort":
      return {
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          expr: rewriteExprNode(item.expr, context),
        })),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "take":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
      };
    case "join":
      return {
        ...stage,
        source: stage.source.kind === "subquery"
          ? {
              ...stage.source,
              query: rewriteQuerySpec(stage.source.query, context),
              inheritedBindings: rewriteInheritedBindings(stage.source.inheritedBindings, context),
            }
          : {
              ...stage.source,
              table: isInternalCteNameValue(stage.source.table.name)
                ? {
                    ...stage.source.table,
                    name: rewriteInternalCteName(
                      stage.source.table.name as InternalCteName,
                      context
                    ),
                  }
                : stage.source.table,
            },
        on: rewriteExprNode(stage.on, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        rightScopeId: rewriteScopeId(stage.rightScopeId, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "unnest":
      return {
        ...stage,
        expr: rewriteExprNode(stage.expr, context),
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        rightScopeId: rewriteScopeId(stage.rightScopeId, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
    case "union":
      return {
        ...stage,
        projectAll: stage.projectAll.map((item) => rewriteProjectionItem(item, context)),
        right: rewriteQuerySpec(stage.right, context),
        outputScopeId: rewriteScopeId(stage.outputScopeId, context),
      };
  }
}

function rewriteSource(source: Source, context: CanonicalizeContext): Source {
  if ("kind" in source || !isInternalCteNameValue(source.table.name)) return source;
  return {
    ...source,
    table: {
      ...source.table,
      name: rewriteInternalCteName(source.table.name as InternalCteName, context),
    },
  };
}

function rewriteProjectionItem(
  item: ProjectionItem,
  context: CanonicalizeContext
): ProjectionItem {
  return {
    ...item,
    expr: rewriteExprNode(item.expr, context),
  };
}

function rewriteExprNode<T>(expr: ExprNode<T>, context: CanonicalizeContext): ExprNode<T> {
  switch (expr.kind) {
    case "column":
      return {
        ...expr,
        table: rewriteExprTable(expr.table, context),
      } as ExprNode<T>;
    case "literal":
    case "param":
      return expr;
    case "binary":
      return {
        ...expr,
        left: rewriteExprNode(expr.left, context),
        right: rewriteExprNode(expr.right, context),
      } as ExprNode<T>;
    case "unary":
    case "group":
      return {
        ...expr,
        expr: rewriteExprNode(expr.expr, context),
      } as ExprNode<T>;
    case "agg":
      return {
        ...expr,
        arg: rewriteExprNode(expr.arg, context),
      } as ExprNode<T>;
    case "func":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprNode(arg, context)),
      } as ExprNode<T>;
    case "list":
    case "array":
      return {
        ...expr,
        items: expr.items.map((item) => rewriteExprNode(item, context)),
      } as ExprNode<T>;
    case "extract":
      return {
        ...expr,
        source: rewriteExprNode(expr.source, context),
      } as ExprNode<T>;
    case "cast":
      return {
        ...expr,
        expr: rewriteExprNode(expr.expr, context),
      } as ExprNode<T>;
    case "window":
      return {
        ...expr,
        args: expr.args.map((arg) => rewriteExprNode(arg, context)),
        partitionBy: expr.partitionBy?.map((item) => rewriteExprNode(item, context)) ?? null,
        orderBy: expr.orderBy?.map((item) => ({
          ...item,
          expr: rewriteExprNode(item.expr, context),
        })) ?? null,
      } as ExprNode<T>;
    case "case":
      return {
        ...expr,
        whens: expr.whens.map((item) => ({
          when: rewriteExprNode(item.when, context),
          then: rewriteExprNode(item.then, context),
        })),
        elseExpr: expr.elseExpr ? rewriteExprNode(expr.elseExpr, context) : null,
      } as ExprNode<T>;
  }
}

function rewriteExprTable(
  table: string | null,
  context: CanonicalizeContext
): string | null {
  if (table === null) return null;
  if (!isInternalScopeNameValue(table)) return table;
  return rewriteScopeId(table as ScopeId, context);
}

function rewriteInheritedBindings(
  bindings: Readonly<Partial<Record<ScopeId, string | null>>> | null,
  context: CanonicalizeContext
): Readonly<Partial<Record<ScopeId, string | null>>> | null {
  if (!bindings) return null;
  const rewritten: Partial<Record<ScopeId, string | null>> = {};
  for (const [scopeId, alias] of Object.entries(bindings)) {
    rewritten[rewriteScopeId(scopeId as ScopeId, context)] = alias;
  }
  return rewritten;
}

function rewriteScopeId(scopeId: ScopeId, context: CanonicalizeContext): ScopeId {
  const existing = context.scopes.get(scopeId);
  if (existing) return existing;
  const next = `__teta_scope_${context.nextScopeIndex++}` as ScopeId;
  context.scopes.set(scopeId, next);
  return next;
}

function rewriteInternalCteName(
  name: InternalCteName,
  context: CanonicalizeContext
): InternalCteName {
  const existing = context.ctes.get(name);
  if (existing) return existing;
  const next = `__teta_cte_loop_${context.nextCteIndex++}` as InternalCteName;
  context.ctes.set(name, next);
  return next;
}

function isInternalScopeNameValue(value: string): boolean {
  return value.startsWith("__teta_scope_");
}

function isInternalCteNameValue(value: string): boolean {
  return value.startsWith("__teta_cte_");
}
