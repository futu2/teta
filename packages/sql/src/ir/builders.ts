export { generatedCteName } from "./types_internal.ts";
export { isValuesSource } from "./types_query.ts";
export { validateQueryIR } from "./validate.ts";
export {
  assertLoopColumns,
  assertUnionCompatible,
  autoAlias,
  columnNamesToIdentifierMap,
  identifierName,
  mergeWiths,
  normalizeIdentifier,
  normalizeJoinType,
  normalizeTableSource,
  projectionItemOutputIdentifier,
  projectionItemOutputName,
  projectionItemsToIdentifierMap,
  shouldQuoteIdentifierName,
  sourceAliasBase,
} from "./utils.ts";
