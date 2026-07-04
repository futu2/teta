import { createColumnRefs } from "../expr.ts";
import { userError } from "../errors.ts";
import { createDeferredRecursiveCte } from "../sql.ts";
import type { Query, QueryStep } from "./core.ts";
import { createQuery } from "./core.ts";
import { freshInternalCteName, freshScopeId } from "./planner.ts";
import { toQuerySpec } from "./state.ts";
import type { QueryColumns } from "./types.ts";
import { assertLoopColumns, normalizeIdentifier } from "./utils.ts";

export function loop<TColumns extends QueryColumns>(
  step: (self: Query<TColumns>) => Query<TColumns>
): QueryStep<TColumns, TColumns>;

export function loop(...args: unknown[]): unknown {
  assertLoopInvocation(args);
  const [step] = args;
  return (base: Query<QueryColumns>) =>
    buildLoop(base, step as (self: Query<QueryColumns>) => Query<QueryColumns>);
}

function buildLoop<TColumns extends QueryColumns>(
  base: Query<TColumns>,
  step: (self: Query<TColumns>) => Query<TColumns>
): Query<TColumns> {
  const name = freshInternalCteName("loop");
  const selfColumnNames = [...base.columnNames];
  const loopSource = {
    db: null,
    table: normalizeIdentifier(name, "table"),
    schema: null,
    as: null,
  };
  const selfScopeId = freshScopeId();
  const self = createQuery<TColumns>({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(selfScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: selfScopeId,
    scopeId: selfScopeId,
    columnIdentifiers: base.columnIdentifiers,
  });
  const stepQuery = step(self);
  assertLoopColumns(base.columnNames, stepQuery.columnNames);
  if (base.withs.length || stepQuery.withs.length) {
    userError("LOOP_NESTED_CTES", "loop does not allow nested CTEs in base or step queries");
  }

  const recursiveCte = createDeferredRecursiveCte(
    name,
    selfColumnNames,
    toQuerySpec(base),
    toQuerySpec(stepQuery)
  );
  const resultScopeId = freshScopeId();
  return createQuery({
    source: loopSource,
    stages: [],
    columns: createColumnRefs<TColumns>(resultScopeId, selfColumnNames),
    columnNames: selfColumnNames,
    sourceScopeId: resultScopeId,
    scopeId: resultScopeId,
    withs: [recursiveCte],
    columnIdentifiers: base.columnIdentifiers,
  });
}

function assertLoopInvocation(args: unknown[]): void {
  if (args.length !== 1 || typeof args[0] !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", "loop() expects loop(step)");
  }
}
