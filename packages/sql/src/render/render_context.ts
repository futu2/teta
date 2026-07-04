import type { SqlRenderContext } from "./types.ts";

let activeRenderContext: SqlRenderContext | null = null;

export function getSqlRenderContext(): SqlRenderContext | null {
  return activeRenderContext;
}

export function createAstRenderContext(): SqlRenderContext {
  return {
    mode: "ast",
    parameterMode: "inline",
    parameterPrefix: ":",
    paramBindings: undefined,
    params: [],
    quotedIdentifiers: [],
    identifierBindings: {},
    columnIdentifierBindings: {},
    cteNameBindings: {},
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
