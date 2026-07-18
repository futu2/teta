import {
  INTERNAL_CTE_PREFIX,
  internalCteLabel,
  isInternalCteName,
  isValuesSource,
  type InternalCteName,
  type Source,
} from "../core/types.ts";
import type { QueryState } from "./state.ts";
import type {
  LogicalCteSpec,
  LogicalJoinSource,
  LogicalQuerySpec,
  LogicalStage,
} from "./logical.ts";

export function rebaseConflictingCtes<TColumns extends Record<string, unknown>>(
  query: QueryState<TColumns>,
  reservedCtes: readonly LogicalCteSpec[],
  firstAvailableIndex: number
): QueryState<TColumns> {
  if (query.withs.length === 0 || reservedCtes.length === 0) return query;

  const reservedNames = new Set(reservedCtes.map((cte) => cte.name));
  const usedNames = new Set([
    ...reservedNames,
    ...query.withs.map((cte) => cte.name),
  ]);
  const renames = new Map<string, InternalCteName>();
  let nextIndex = Math.max(firstAvailableIndex, query.nameSupply.cte);

  for (const cte of query.withs) {
    if (!reservedNames.has(cte.name) || !isInternalCteName(cte.name)) continue;

    const label = internalCteLabel(cte.name) ?? "cte";
    let candidate: InternalCteName;
    do {
      candidate = `${INTERNAL_CTE_PREFIX}${label}_${nextIndex++}`;
    } while (usedNames.has(candidate));

    renames.set(cte.name, candidate);
    usedNames.add(candidate);
  }

  if (renames.size === 0) return query;

  return {
    ...query,
    source: rewriteSource(query.source, renames),
    stages: query.stages.map((stage) => rewriteStage(stage, renames)),
    withs: query.withs.map((cte) => rewriteCte(cte, renames)),
    nameSupply: Object.freeze({
      ...query.nameSupply,
      cte: Math.max(query.nameSupply.cte, nextIndex),
    }),
  };
}

function rewriteCte(
  cte: LogicalCteSpec,
  renames: ReadonlyMap<string, InternalCteName>
): LogicalCteSpec {
  switch (cte.kind) {
    case "query":
      return {
        ...cte,
        name: rewriteName(cte.name, renames),
        query: rewriteQuerySpec(cte.query, renames),
      };
    case "recursive":
      return {
        ...cte,
        name: rewriteName(cte.name, renames),
        base: rewriteQuerySpec(cte.base, renames),
        step: rewriteQuerySpec(cte.step, renames),
      };
  }
}

function rewriteQuerySpec(
  spec: LogicalQuerySpec,
  renames: ReadonlyMap<string, InternalCteName>
): LogicalQuerySpec {
  return {
    ...spec,
    source: rewriteSource(spec.source, renames),
    stages: spec.stages.map((stage) => rewriteStage(stage, renames)),
  };
}

function rewriteStage(
  stage: LogicalStage,
  renames: ReadonlyMap<string, InternalCteName>
): LogicalStage {
  switch (stage.kind) {
    case "join":
      return {
        ...stage,
        source: rewriteJoinSource(stage.source, renames),
      };
    case "union":
      return {
        ...stage,
        right: rewriteQuerySpec(stage.right, renames),
      };
    default:
      return stage;
  }
}

function rewriteJoinSource(
  source: LogicalJoinSource,
  renames: ReadonlyMap<string, InternalCteName>
): LogicalJoinSource {
  if (source.kind === "subquery") {
    return {
      ...source,
      query: rewriteQuerySpec(source.query, renames),
    };
  }

  const name = rewriteName(source.table.name, renames);
  if (name === source.table.name) return source;
  return {
    ...source,
    table: { ...source.table, name },
  };
}

function rewriteSource(
  source: Source,
  renames: ReadonlyMap<string, InternalCteName>
): Source {
  if (isValuesSource(source)) return source;
  const name = rewriteName(source.table.name, renames);
  if (name === source.table.name) return source;
  return {
    ...source,
    table: { ...source.table, name },
  };
}

function rewriteName(
  name: string,
  renames: ReadonlyMap<string, InternalCteName>
): string {
  return renames.get(name) ?? name;
}
