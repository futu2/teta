export {
  col,
  leftCol,
  resolveDeferredExpr,
  resolveDeferredOrderItem,
  resolveDeferredProjectionShape,
  rightCol,
  type DeferredResolutionScope,
} from "./core/expr/deferred.ts";
export type {
  DeferredExprDeps,
  DeferredExprDepsForArgs,
  DeferredExprDepsOf,
  DeferredExprDepScope,
  DeferredOrderItem,
  EmptyDeferredExprDeps,
} from "./core/expr/runtime.ts";
