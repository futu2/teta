import { createColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import { createDeferredRecursiveCte } from "../sql.ts";
import type { Query, QueryStep } from "./core.ts";
import { createQuery, createQueryStep, getQueryState } from "./core.ts";
import { allocateInternalCteName, allocateScopeId } from "./planner.ts";
import { toQuerySpec } from "./state.ts";
import type { QueryColumns } from "./types.ts";
import { assertLoopColumns, normalizeIdentifier } from "./utils.ts";

export function loop<TColumns extends QueryColumns>(
  step: (self: Query<TColumns>) => Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function loop(...args: unknown[]): unknown {
  assertLoopInvocation(args);
  const [step] = args;
  return createQueryStep("loop", (base: Query<QueryColumns>) =>
    buildLoop(base, step as (self: Query<QueryColumns>) => Query<QueryColumns>));
}

function buildLoop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  const baseState = getQueryState(base);
  const allocatedName = allocateInternalCteName(baseState, "loop");
  const allocatedSelf = allocateScopeId({ nameSupply: allocatedName.nameSupply });
  const name = allocatedName.name;
  const selfColumnNames = [...baseState.columnNames];
  const loopSource = {
    db: null,
    table: normalizeIdentifier(name, "table"),
    schema: null,
    as: null,
  };
  const selfScopeId = allocatedSelf.scopeId;
  const self = createQuery<TColumns>({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(selfScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: selfScopeId,
    scopeId: selfScopeId,
    columnIdentifiers: baseState.columnIdentifiers,
    nameSupply: allocatedSelf.nameSupply,
  });
  const stepQuery = step(self);
  const stepState = getQueryState(stepQuery);
  assertLoopColumns(baseState.columnNames, stepState.columnNames);
  if (baseState.withs.length || stepState.withs.length) {
    userError("LOOP_NESTED_CTES", "loop does not allow nested CTEs in base or step queries");
  }

  const recursiveCte = createDeferredRecursiveCte(
    name,
    selfColumnNames,
    toQuerySpec(baseState),
    toQuerySpec(stepState)
  );
  const allocatedResult = allocateScopeId({
    nameSupply: {
      scope: Math.max(allocatedSelf.nameSupply.scope, stepState.nameSupply.scope),
      cte: Math.max(allocatedSelf.nameSupply.cte, stepState.nameSupply.cte),
    },
  });
  const resultScopeId = allocatedResult.scopeId;
  return createQuery({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(resultScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: resultScopeId,
    scopeId: resultScopeId,
    withs: [recursiveCte],
    columnIdentifiers: baseState.columnIdentifiers,
    nameSupply: allocatedResult.nameSupply,
  });
}

function assertLoopInvocation(args: unknown[]): void {
  if (args.length !== 1 || typeof args[0] !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "loop() expects loop(step)");
  }
}
