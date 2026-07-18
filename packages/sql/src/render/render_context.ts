import type { SqlRenderContext } from "./types.ts";
import { createDictionary } from "../dictionary.ts";

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
