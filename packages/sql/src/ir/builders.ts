export { generatedCteName } from "./types_internal.ts";
export { isValuesSource } from "./types_query.ts";
export {
  assertSqlCastTarget,
  assertSqlExtractField,
  assertSqlFunctionName,
  assertSqlNamedParameter,
  assertSqlParameterName,
  assertSqlPositionalParameter,
  isSqlCastTarget,
  isSqlFunctionName,
  isSqlIdentifierSegment,
  isSqlNamedParameter,
  isSqlParameterName,
  isSqlPositionalParameter,
} from "./tokens.ts";
export { validateExprIR } from "./validate.ts";
export {
  lowerPortableQueryIR,
  toPortableQueryIR,
  validateQueryIR,
} from "./portable.ts";
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
