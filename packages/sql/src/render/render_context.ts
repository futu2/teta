import type { SqlRenderContext } from "./types.ts";
import { createDictionary } from "../dictionary.ts";

let activeRenderContext: SqlRenderContext | null = null;

export function getSqlRenderContext(): SqlRenderContext | null {
  return activeRenderContext;
}

export function createAstRenderContext(
  dialect: SqlRenderContext["dialect"] = null
): SqlRenderContext {
  return {
    mode: "ast",
    dialect,
    parameterMode: "inline",
    parameterPrefix: ":",
    paramBindings: undefined,
    params: [],
    reservedParameterNames: new Set(),
    nextAutoParameterIndex: 1,
    identifierBindings: createDictionary(),
    columnIdentifierBindings: createDictionary(),
    cteNameBindings: createDictionary(),
    nextInternalCteIndex: 0,
  };
}

export function withSqlRenderContext<T>(
  context: SqlRenderContext,
  render: () => T
): T {
  const previous = activeRenderContext;
  activeRenderContext = context;
  try {
    return render();
  } finally {
    activeRenderContext = previous;
  }
}
