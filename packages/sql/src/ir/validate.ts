import { userError } from "../errors.ts";
import type { ExprSqlTarget, QueryIRSqlTarget } from "../renderer_types.ts";
import {
  OUTER_TABLE_ALIAS,
  TETA_QUERY_IR_VERSION,
  type BinaryOp,
  type ExprNode,
  type QueryIR,
  type SqlIdentifier,
  type Value,
} from "./types.ts";
import {
  isSqlCastTarget,
  isSqlFunctionName,
  isSqlDateLiteral,
  isSqlIdentifierSegment,
  isSqlParameterName,
  isSqlTimestampLiteral,
} from "./tokens.ts";
import {
  formatBuiltinFunctionArity,
  isBuiltinFunctionArityValid,
  isBuiltinFunctionOperation,
} from "../language/spec.ts";

const BINARY_OPS = new Set<BinaryOp>([
  "=", "!=", "<", "<=", ">", ">=", "AND", "OR", "+", "-", "*", "/", "||",
  "LIKE", "IS", "IS NOT", "IN", "NOT IN", "BETWEEN", "IS DISTINCT FROM",
]);
const JOIN_TYPES = new Set(["INNER", "LEFT", "RIGHT", "FULL"]);
const ORDER_DIRECTIONS = new Set(["ASC", "DESC"]);

type ScopeColumns = ReadonlySet<string> | null;
type ScopeEnvironment = Map<string, ScopeColumns>;

/**
 * Decode and validate a versioned query IR target before it reaches the renderer.
 *
 * This is the public ABI boundary for frontends implemented in any language.
 * It intentionally validates runtime shape, SQL tokens, and renderer-required
 * metadata rather than trusting TypeScript's compile-time declarations.
 */
/** Validate the renderer's private query target after portable IR lowering. */
export function validateQueryIRSqlTarget(value: unknown): asserts value is QueryIRSqlTarget {
  const target = asRecord(value, "query");
  assertKnownKeys(target, "query", [
    "version",
    "source",
    "stages",
    "scopeId",
    "columnNames",
    "columnIdentifiers",
    "withs",
  ]);
  if (target.version !== TETA_QUERY_IR_VERSION) {
    invalid("query.version", `must equal ${TETA_QUERY_IR_VERSION}`);
  }
  validateQueryTarget(target, "query");
  validateCteScopeSemantics(target.withs, "query.withs");
  validateQueryScopeSemantics(target, "query", new Map());
}

/** Decode and validate a standalone public expression IR target. */
export function validateExprIR(value: unknown): asserts value is ExprSqlTarget {
  const candidate = asRecord(value, "expression");
  if ("node" in candidate) {
    assertKnownKeys(candidate, "expression", ["node"]);
    validateExprNode(candidate.node, "expression.node");
    return;
  }
  validateExprNode(candidate, "expression");
}

function validateQueryTarget(value: Record<string, unknown>, path: string): void {
  validateSource(value.source, `${path}.source`);
  validateScope(value.scopeId, `${path}.scopeId`);
  validateColumnMetadata(value.columnNames, value.columnIdentifiers, path);

  const stages = asArray(value.stages, `${path}.stages`);
  const stageOutputs = stages.map((stage, index) =>
    validateStage(stage, `${path}.stages[${index}]`)
  );
  const finalStageOutput = stageOutputs.at(-1);
  if (finalStageOutput && !sameNames(finalStageOutput, value.columnNames)) {
    invalid(`${path}.columnNames`, "must match the output columns of the final stage");
  }

  if (value.withs !== undefined) {
    asArray(value.withs, `${path}.withs`).forEach((cte, index) =>
      validateCte(cte, `${path}.withs[${index}]`)
    );
  }
}

function validateQuerySpec(value: unknown, path: string): void {
  const query = asRecord(value, path);
  assertKnownKeys(query, path, ["source", "stages", "scopeId", "columnNames", "columnIdentifiers"]);
  validateQueryTarget(query, path);
}

function validateCteScopeSemantics(value: unknown, path: string): void {
  if (value === undefined) return;
  asArray(value, path).forEach((cte, index) => {
    const record = asRecord(cte, `${path}[${index}]`);
    if (record.kind === "query") {
      validateQueryScopeSemantics(
        asRecord(record.query, `${path}[${index}].query`),
        `${path}[${index}].query`,
        new Map()
      );
      return;
    }
    if (record.kind === "recursive") {
      validateQueryScopeSemantics(
        asRecord(record.base, `${path}[${index}].base`),
        `${path}[${index}].base`,
        new Map()
      );
      validateQueryScopeSemantics(
        asRecord(record.step, `${path}[${index}].step`),
        `${path}[${index}].step`,
        new Map()
      );
    }
  });
}

/** Validate that each query stage only refers to row scopes available at that point. */
function validateQueryScopeSemantics(
  query: Record<string, unknown>,
  path: string,
  outerScopes: ScopeEnvironment
): void {
  const scopeId = query.scopeId as string;
  if (outerScopes.has(scopeId)) {
    invalid(`${path}.scopeId`, "must not shadow an inherited scope");
  }
  const stages = asArray(query.stages, `${path}.stages`);
  const environment = new Map(outerScopes);
  let currentScopeId = scopeId;
  environment.set(currentScopeId, sourceColumnNames(query, stages));

  stages.forEach((value, index) => {
    const stage = asRecord(value, `${path}.stages[${index}]`);
    const stagePath = `${path}.stages[${index}]`;
    switch (stage.kind) {
      case "map":
      case "fold": {
        validateProjectionScopeExpressions(stage.items, `${stagePath}.items`, environment);
        if (stage.kind === "fold" && stage.groupBy !== null) {
          validateExpressionScopeArray(stage.groupBy, `${stagePath}.groupBy`, environment);
        }
        const outputNames = projectionOutputNames(stage.items, `${stagePath}.items`);
        currentScopeId = advanceScope(
          environment,
          currentScopeId,
          stage.outputScopeId,
          outputNames,
          `${stagePath}.outputScopeId`
        );
        return;
      }
      case "filter":
        validateExpressionScopes(stage.predicate, `${stagePath}.predicate`, environment);
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        return;
      case "sort":
        validateOrderScopeExpressions(stage.items, `${stagePath}.items`, environment);
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        return;
      case "take":
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        return;
      case "join": {
        const source = asRecord(stage.source, `${stagePath}.source`);
        const rightColumns = joinSourceColumnNames(
          source,
          stage,
          stagePath,
          environment,
          environment.get(currentScopeId) ?? null
        );
        const rightScopeId = stage.rightScopeId as string;
        assertFreshScope(environment, rightScopeId, `${stagePath}.rightScopeId`);
        environment.set(rightScopeId, rightColumns);
        validateExpressionScopes(stage.on, `${stagePath}.on`, environment);
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        const outputNames = projectionOutputNames(stage.projectAll, `${stagePath}.projectAll`);
        environment.delete(rightScopeId);
        currentScopeId = advanceScope(
          environment,
          currentScopeId,
          stage.outputScopeId,
          outputNames,
          `${stagePath}.outputScopeId`
        );
        return;
      }
      case "unnest": {
        validateExpressionScopes(stage.expr, `${stagePath}.expr`, environment);
        const rightScopeId = stage.rightScopeId as string;
        assertFreshScope(environment, rightScopeId, `${stagePath}.rightScopeId`);
        environment.set(rightScopeId, new Set(stage.columnNames as string[]));
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        const outputNames = projectionOutputNames(stage.projectAll, `${stagePath}.projectAll`);
        environment.delete(rightScopeId);
        currentScopeId = advanceScope(
          environment,
          currentScopeId,
          stage.outputScopeId,
          outputNames,
          `${stagePath}.outputScopeId`
        );
        return;
      }
      case "union": {
        const right = asRecord(stage.right, `${stagePath}.right`);
        validateQueryScopeSemantics(right, `${stagePath}.right`, new Map());
        validateProjectionScopeExpressions(stage.projectAll, `${stagePath}.projectAll`, environment);
        const outputNames = projectionOutputNames(stage.projectAll, `${stagePath}.projectAll`);
        if (!sameNames(outputNames, right.columnNames)) {
          invalid(`${stagePath}.right.columnNames`, "must match the union projection columns");
        }
        currentScopeId = advanceScope(
          environment,
          currentScopeId,
          stage.outputScopeId,
          outputNames,
          `${stagePath}.outputScopeId`
        );
        return;
      }
    }
  });
}

function sourceColumnNames(
  query: Record<string, unknown>,
  stages: readonly unknown[]
): ScopeColumns {
  const source = asRecord(query.source, "query source");
  if (source.kind === "values") {
    const firstRow = asRecord(asArray(source.rows, "query source rows")[0], "query source row");
    return new Set(Object.keys(firstRow));
  }
  return stages.length === 0 ? new Set(query.columnNames as string[]) : null;
}

function joinSourceColumnNames(
  source: Record<string, unknown>,
  stage: Record<string, unknown>,
  stagePath: string,
  environment: ScopeEnvironment,
  outerColumns: ScopeColumns
): ScopeColumns {
  if (source.kind === "table") {
    return new Set(Object.keys(asRecord(source.columnIdentifiers, `${stagePath}.source.columnIdentifiers`)));
  }
  if (source.kind === "subquery") {
    const inherited = inheritedScopeEnvironment(
      source.inheritedBindings,
      environment,
      `${stagePath}.source.inheritedBindings`
    );
    if (stage.lateral === true) inherited.set(OUTER_TABLE_ALIAS, outerColumns);
    const query = asRecord(source.query, `${stagePath}.source.query`);
    validateQueryScopeSemantics(query, `${stagePath}.source.query`, inherited);
    return new Set(query.columnNames as string[]);
  }
  invalid(`${stagePath}.source.kind`, "must be table or subquery");
}

function inheritedScopeEnvironment(
  value: unknown,
  environment: ScopeEnvironment,
  path: string
): ScopeEnvironment {
  if (value === null) return new Map();
  const bindings = asRecord(value, path);
  const inherited: ScopeEnvironment = new Map();
  for (const scopeId of Object.keys(bindings)) {
    const columns = environment.get(scopeId);
    if (columns === undefined) invalid(`${path}.${scopeId}`, "must reference an available outer scope");
    inherited.set(scopeId, columns);
  }
  return inherited;
}

function advanceScope(
  environment: ScopeEnvironment,
  currentScopeId: string,
  outputScopeId: unknown,
  columns: readonly string[],
  path: string
): string {
  if (typeof outputScopeId !== "string") invalid(path, "must be a SQL scope identifier");
  environment.delete(currentScopeId);
  assertFreshScope(environment, outputScopeId, path);
  environment.set(outputScopeId, new Set(columns));
  return outputScopeId;
}

function assertFreshScope(environment: ScopeEnvironment, scopeId: string, path: string): void {
  if (environment.has(scopeId)) invalid(path, "must introduce a new scope");
}

function projectionOutputNames(value: unknown, path: string): string[] {
  return asArray(value, path).map((item, index) => {
    const projection = asRecord(item, `${path}[${index}]`);
    if (projection.as !== null) return (projection.as as { name: string }).name;
    return (projection.expr as { name: string }).name;
  });
}

function validateProjectionScopeExpressions(
  value: unknown,
  path: string,
  environment: ScopeEnvironment
): void {
  asArray(value, path).forEach((item, index) => {
    const projection = asRecord(item, `${path}[${index}]`);
    validateExpressionScopes(projection.expr, `${path}[${index}].expr`, environment);
  });
}

function validateOrderScopeExpressions(
  value: unknown,
  path: string,
  environment: ScopeEnvironment
): void {
  asArray(value, path).forEach((item, index) => {
    const order = asRecord(item, `${path}[${index}]`);
    validateExpressionScopes(order.expr, `${path}[${index}].expr`, environment);
  });
}

function validateExpressionScopeArray(
  value: unknown,
  path: string,
  environment: ScopeEnvironment
): void {
  asArray(value, path).forEach((item, index) =>
    validateExpressionScopes(item, `${path}[${index}]`, environment)
  );
}

function validateExpressionScopes(
  value: unknown,
  path: string,
  environment: ScopeEnvironment
): void {
  const expr = asRecord(value, path);
  switch (expr.kind) {
    case "column":
      validateColumnScope(expr, path, environment);
      return;
    case "literal":
    case "param":
      return;
    case "binary":
      validateExpressionScopes(expr.left, `${path}.left`, environment);
      validateExpressionScopes(expr.right, `${path}.right`, environment);
      return;
    case "unary":
    case "group":
    case "cast":
      validateExpressionScopes(expr.expr, `${path}.expr`, environment);
      return;
    case "agg":
      validateExpressionScopes(expr.arg, `${path}.arg`, environment);
      return;
    case "builtin":
    case "func":
      validateExpressionScopeArray(expr.args, `${path}.args`, environment);
      return;
    case "list":
    case "array":
      validateExpressionScopeArray(expr.items, `${path}.items`, environment);
      return;
    case "extract":
      validateExpressionScopes(expr.source, `${path}.source`, environment);
      return;
    case "window":
      validateExpressionScopeArray(expr.args, `${path}.args`, environment);
      if (expr.partitionBy !== null) {
        validateExpressionScopeArray(expr.partitionBy, `${path}.partitionBy`, environment);
      }
      if (expr.orderBy !== null) {
        validateOrderScopeExpressions(expr.orderBy, `${path}.orderBy`, environment);
      }
      return;
    case "case":
      asArray(expr.whens, `${path}.whens`).forEach((branch, index) => {
        const record = asRecord(branch, `${path}.whens[${index}]`);
        validateExpressionScopes(record.when, `${path}.whens[${index}].when`, environment);
        validateExpressionScopes(record.then, `${path}.whens[${index}].then`, environment);
      });
      if (expr.elseExpr !== null) {
        validateExpressionScopes(expr.elseExpr, `${path}.elseExpr`, environment);
      }
      return;
  }
}

function validateColumnScope(
  column: Record<string, unknown>,
  path: string,
  environment: ScopeEnvironment
): void {
  const name = column.name as string;
  if (column.table === null) {
    if (![...environment.values()].some((columns) => columns === null || columns.has(name))) {
      invalid(`${path}.name`, "must reference an available column");
    }
    return;
  }
  const columns = environment.get(column.table as string);
  if (columns === undefined) invalid(`${path}.table`, "must reference an available scope");
  if (columns !== null && !columns.has(name)) {
    invalid(`${path}.name`, "must reference a column exposed by its scope");
  }
}

function validateSource(value: unknown, path: string): void {
  const source = asRecord(value, path);
  if (source.kind === "values") {
    assertKnownKeys(source, path, ["kind", "rows"]);
    const rows = asArray(source.rows, `${path}.rows`);
    if (rows.length === 0) invalid(`${path}.rows`, "must contain at least one row");
    const first = asRecord(rows[0], `${path}.rows[0]`);
    const columnNames = Object.keys(first);
    if (columnNames.length === 0) invalid(`${path}.rows[0]`, "must contain at least one column");
    columnNames.forEach((name) => validateLogicalName(name, `${path}.rows[0] key`));
    rows.forEach((row, index) => {
      const record = asRecord(row, `${path}.rows[${index}]`);
      const keys = Object.keys(record);
      if (keys.length !== columnNames.length || columnNames.some((key) => !(key in record))) {
        invalid(`${path}.rows[${index}]`, "must have the same columns as the first row");
      }
      for (const key of columnNames) {
        validateLogicalName(key, `${path}.rows[${index}] key`);
        validateValue(record[key], `${path}.rows[${index}].${key}`);
      }
    });
    return;
  }

  assertKnownKeys(source, path, ["db", "schema", "table", "as"]);
  validateNullableIdentifier(source.db, `${path}.db`);
  validateNullableIdentifier(source.schema, `${path}.schema`);
  validateIdentifier(source.table, `${path}.table`);
  validateNullableIdentifier(source.as, `${path}.as`);
}

function validateStage(value: unknown, path: string): readonly string[] {
  const stage = asRecord(value, path);
  switch (stage.kind) {
    case "map":
      assertKnownKeys(stage, path, ["kind", "items", "keys", "groupBy", "outputScopeId"]);
      return validateProjectionStage(stage, path, false);
    case "fold":
      assertKnownKeys(stage, path, ["kind", "items", "keys", "groupBy", "outputScopeId"]);
      return validateProjectionStage(stage, path, true);
    case "filter":
      assertKnownKeys(stage, path, ["kind", "predicate", "projectAll"]);
      validateExprNode(stage.predicate, `${path}.predicate`);
      return validateProjectionItems(stage.projectAll, `${path}.projectAll`);
    case "sort":
      assertKnownKeys(stage, path, ["kind", "items", "projectAll"]);
      validateOrderItems(stage.items, `${path}.items`);
      return validateProjectionItems(stage.projectAll, `${path}.projectAll`);
    case "take":
      assertKnownKeys(stage, path, ["kind", "count", "projectAll"]);
      if (!isNonNegativeInteger(stage.count)) invalid(`${path}.count`, "must be a finite non-negative integer");
      return validateProjectionItems(stage.projectAll, `${path}.projectAll`);
    case "join":
      assertKnownKeys(stage, path, [
        "kind",
        "joinType",
        "lateral",
        "source",
        "as",
        "on",
        "projectAll",
        "rightScopeId",
        "outputScopeId",
      ]);
      if (typeof stage.joinType !== "string" || !JOIN_TYPES.has(stage.joinType)) {
        invalid(`${path}.joinType`, "must be INNER, LEFT, RIGHT, or FULL");
      }
      if (stage.lateral !== undefined && typeof stage.lateral !== "boolean") {
        invalid(`${path}.lateral`, "must be boolean when present");
      }
      validateJoinSource(stage.source, `${path}.source`);
      validateNullableAlias(stage.as, `${path}.as`);
      validateExprNode(stage.on, `${path}.on`);
      const joinOutputNames = validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateScope(stage.rightScopeId, `${path}.rightScopeId`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return joinOutputNames;
    case "unnest":
      assertKnownKeys(stage, path, [
        "kind",
        "mode",
        "expr",
        "withOrdinality",
        "as",
        "columnNames",
        "columnIdentifiers",
        "projectAll",
        "rightScopeId",
        "outputScopeId",
      ]);
      if (stage.mode !== "inner" && stage.mode !== "outer") {
        invalid(`${path}.mode`, "must be inner or outer");
      }
      validateExprNode(stage.expr, `${path}.expr`);
      if (typeof stage.withOrdinality !== "boolean") {
        invalid(`${path}.withOrdinality`, "must be boolean");
      }
      validateNullableAlias(stage.as, `${path}.as`);
      validateColumnMetadata(stage.columnNames, stage.columnIdentifiers, path);
      const unnestOutputNames = validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateScope(stage.rightScopeId, `${path}.rightScopeId`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return unnestOutputNames;
    case "union":
      assertKnownKeys(stage, path, ["kind", "op", "projectAll", "right", "outputScopeId"]);
      if (stage.op !== "union" && stage.op !== "union all") {
        invalid(`${path}.op`, "must be union or union all");
      }
      const unionOutputNames = validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateQuerySpec(stage.right, `${path}.right`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return unionOutputNames;
    default:
      invalid(`${path}.kind`, "is not a supported query stage");
  }
}

function validateProjectionStage(
  stage: Record<string, unknown>,
  path: string,
  isFold: boolean
): readonly string[] {
  const itemNames = validateProjectionItems(stage.items, `${path}.items`);
  const keys = validateColumnNames(stage.keys, `${path}.keys`);
  if (!sameNames(keys, itemNames)) {
    invalid(`${path}.keys`, "must describe each projected item in order");
  }
  if (isFold) {
    if (stage.groupBy !== null) validateExprArray(stage.groupBy, `${path}.groupBy`);
  } else if (stage.groupBy !== null) {
    invalid(`${path}.groupBy`, "must be null for a map stage");
  }
  validateScope(stage.outputScopeId, `${path}.outputScopeId`);
  return keys;
}

function validateJoinSource(value: unknown, path: string): void {
  const source = asRecord(value, path);
  if (source.kind === "table") {
    assertKnownKeys(source, path, ["kind", "db", "schema", "table", "columnIdentifiers"]);
    validateNullableIdentifier(source.db, `${path}.db`);
    validateNullableIdentifier(source.schema, `${path}.schema`);
    validateIdentifier(source.table, `${path}.table`);
    validateColumnIdentifiers(source.columnIdentifiers, `${path}.columnIdentifiers`);
    return;
  }
  if (source.kind === "subquery") {
    assertKnownKeys(source, path, ["kind", "query", "inheritedBindings"]);
    validateQuerySpec(source.query, `${path}.query`);
    if (source.inheritedBindings !== null) {
      const bindings = asRecord(source.inheritedBindings, `${path}.inheritedBindings`);
      for (const [scopeId, alias] of Object.entries(bindings)) {
        validateScope(scopeId, `${path}.inheritedBindings key`);
        validateNullableAlias(alias, `${path}.inheritedBindings.${scopeId}`);
      }
    }
    return;
  }
  invalid(`${path}.kind`, "must be table or subquery");
}

function validateCte(value: unknown, path: string): void {
  const cte = asRecord(value, path);
  if (cte.kind === "query") {
    assertKnownKeys(cte, path, ["kind", "name", "query"]);
    validateAlias(cte.name, `${path}.name`);
    validateQuerySpec(cte.query, `${path}.query`);
    return;
  }
  if (cte.kind === "recursive") {
    assertKnownKeys(cte, path, ["kind", "name", "columnNames", "base", "step"]);
    validateAlias(cte.name, `${path}.name`);
    validateColumnNames(cte.columnNames, `${path}.columnNames`);
    validateQuerySpec(cte.base, `${path}.base`);
    validateQuerySpec(cte.step, `${path}.step`);
    return;
  }
  invalid(`${path}.kind`, "must be query or recursive");
}

function validateExprNode(value: unknown, path: string): asserts value is ExprNode<unknown> {
  const node = asRecord(value, path);
  switch (node.kind) {
    case "column":
      assertKnownKeys(node, path, ["kind", "table", "name"]);
      if (node.table !== null) validateScope(node.table, `${path}.table`);
      validateLogicalName(node.name, `${path}.name`);
      return;
    case "literal":
      assertKnownKeys(node, path, ["kind", "value"]);
      validateValue(node.value, `${path}.value`);
      return;
    case "param":
      assertKnownKeys(node, path, ["kind", "name"]);
      if (typeof node.name !== "string" || !isSqlParameterName(node.name)) {
        invalid(`${path}.name`, "must be a named identifier or positive positional index");
      }
      return;
    case "binary":
      assertKnownKeys(node, path, ["kind", "op", "left", "right"]);
      if (typeof node.op !== "string" || !BINARY_OPS.has(node.op as BinaryOp)) {
        invalid(`${path}.op`, "is not a supported binary operator");
      }
      validateExprNode(node.left, `${path}.left`);
      validateExprNode(node.right, `${path}.right`);
      return;
    case "unary":
      assertKnownKeys(node, path, ["kind", "op", "expr"]);
      if (node.op !== "NOT") invalid(`${path}.op`, "must be NOT");
      validateExprNode(node.expr, `${path}.expr`);
      return;
    case "agg":
      assertKnownKeys(node, path, ["kind", "name", "arg", "distinct"]);
      validateFunctionName(node.name, `${path}.name`);
      validateExprNode(node.arg, `${path}.arg`);
      if (typeof node.distinct !== "boolean") invalid(`${path}.distinct`, "must be boolean");
      return;
    case "group":
      assertKnownKeys(node, path, ["kind", "expr"]);
      validateExprNode(node.expr, `${path}.expr`);
      return;
    case "builtin":
      assertKnownKeys(node, path, ["kind", "op", "args"]);
      if (typeof node.op !== "string" || !isBuiltinFunctionOperation(node.op)) {
        invalid(`${path}.op`, "must be a portable built-in operation");
      }
      const args = asArray(node.args, `${path}.args`);
      validateExprArray(args, `${path}.args`);
      if (!isBuiltinFunctionArityValid(node.op, args.length)) {
        invalid(
          `${path}.args`,
          `${node.op} expects ${formatBuiltinFunctionArity(node.op)}`
        );
      }
      return;
    case "func":
      assertKnownKeys(node, path, ["kind", "name", "args"]);
      validateFunctionName(node.name, `${path}.name`);
      validateExprArray(node.args, `${path}.args`);
      return;
    case "list":
    case "array":
      assertKnownKeys(node, path, ["kind", "items"]);
      validateExprArray(node.items, `${path}.items`);
      return;
    case "extract":
      assertKnownKeys(node, path, ["kind", "field", "source"]);
      if (typeof node.field !== "string" || !isSqlIdentifierSegment(node.field)) {
        invalid(`${path}.field`, "must be a SQL identifier");
      }
      validateExprNode(node.source, `${path}.source`);
      return;
    case "cast":
      assertKnownKeys(node, path, ["kind", "expr", "target"]);
      if (typeof node.target !== "string" || !isSqlCastTarget(node.target)) {
        invalid(`${path}.target`, "must be a safe SQL type declaration");
      }
      validateExprNode(node.expr, `${path}.expr`);
      return;
    case "window":
      assertKnownKeys(node, path, ["kind", "name", "args", "partitionBy", "orderBy"]);
      validateFunctionName(node.name, `${path}.name`);
      validateExprArray(node.args, `${path}.args`);
      if (node.partitionBy !== null) validateExprArray(node.partitionBy, `${path}.partitionBy`);
      if (node.orderBy !== null) validateOrderItems(node.orderBy, `${path}.orderBy`);
      return;
    case "case":
      assertKnownKeys(node, path, ["kind", "whens", "elseExpr"]);
      const whens = asArray(node.whens, `${path}.whens`);
      if (whens.length === 0) invalid(`${path}.whens`, "must contain at least one branch");
      whens.forEach((branch, index) => {
        const record = asRecord(branch, `${path}.whens[${index}]`);
        assertKnownKeys(record, `${path}.whens[${index}]`, ["when", "then"]);
        validateExprNode(record.when, `${path}.whens[${index}].when`);
        validateExprNode(record.then, `${path}.whens[${index}].then`);
      });
      if (node.elseExpr !== null) validateExprNode(node.elseExpr, `${path}.elseExpr`);
      return;
    default:
      invalid(`${path}.kind`, "is not a supported expression node");
  }
}

function validateProjectionItems(value: unknown, path: string): string[] {
  const names = asArray(value, path).map((item, index) => {
    const projection = asRecord(item, `${path}[${index}]`);
    assertKnownKeys(projection, `${path}[${index}]`, ["expr", "as"]);
    validateExprNode(projection.expr, `${path}[${index}].expr`);
    validateNullableIdentifier(projection.as, `${path}[${index}].as`);
    if (projection.as && typeof projection.as === "object") {
      return (projection.as as { name: string }).name;
    }
    const expr = asRecord(projection.expr, `${path}[${index}].expr`);
    if (expr.kind === "column" && typeof expr.name === "string") return expr.name;
    invalid(`${path}[${index}].as`, "is required when the expression is not a column");
  });
  if (names.length === 0 || new Set(names).size !== names.length) {
    invalid(path, "must contain one or more uniquely named output columns");
  }
  return names;
}

function validateOrderItems(value: unknown, path: string): void {
  asArray(value, path).forEach((item, index) => {
    const order = asRecord(item, `${path}[${index}]`);
    assertKnownKeys(order, `${path}[${index}]`, ["expr", "direction"]);
    validateExprNode(order.expr, `${path}[${index}].expr`);
    if (typeof order.direction !== "string" || !ORDER_DIRECTIONS.has(order.direction)) {
      invalid(`${path}[${index}].direction`, "must be ASC or DESC");
    }
  });
}

function validateExprArray(value: unknown, path: string): void {
  asArray(value, path).forEach((item, index) => validateExprNode(item, `${path}[${index}]`));
}

function validateColumnMetadata(
  columnNamesValue: unknown,
  identifiersValue: unknown,
  path: string
): void {
  const columnNames = validateColumnNames(columnNamesValue, `${path}.columnNames`);
  const identifiers = validateColumnIdentifiers(identifiersValue, `${path}.columnIdentifiers`);
  const identifierNames = Object.keys(identifiers);
  if (
    identifierNames.length !== columnNames.length
    || columnNames.some((name) => !Object.hasOwn(identifiers, name))
  ) {
    invalid(`${path}.columnIdentifiers`, "must contain exactly one identifier for every output column");
  }
}

function validateColumnIdentifiers(value: unknown, path: string): Record<string, SqlIdentifier> {
  const identifiers = asRecord(value, path);
  for (const [name, identifier] of Object.entries(identifiers)) {
    validateLogicalName(name, `${path} key`);
    validateIdentifier(identifier, `${path}.${name}`);
  }
  return identifiers as Record<string, SqlIdentifier>;
}

function validateIdentifier(value: unknown, path: string): void {
  const identifier = asRecord(value, path);
  assertKnownKeys(identifier, path, ["name", "quoted"]);
  if (typeof identifier.name !== "string" || identifier.name.length === 0 || identifier.name.includes("\u0000")) {
    invalid(`${path}.name`, "must be a non-empty identifier name");
  }
  if (typeof identifier.quoted !== "boolean") invalid(`${path}.quoted`, "must be boolean");
  if (!identifier.quoted && !isSqlIdentifierSegment(identifier.name)) {
    invalid(`${path}.name`, "must be a bare SQL identifier when quoted is false");
  }
}

function validateNullableIdentifier(value: unknown, path: string): void {
  if (value === null) return;
  validateIdentifier(value, path);
}

function validateFunctionName(value: unknown, path: string): void {
  if (typeof value !== "string" || !isSqlFunctionName(value)) {
    invalid(path, "must be a dot-separated SQL identifier");
  }
}

function validateScope(value: unknown, path: string): void {
  if (typeof value !== "string" || !isSqlIdentifierSegment(value)) {
    invalid(path, "must be a SQL scope identifier");
  }
}

function validateAlias(value: unknown, path: string): void {
  if (typeof value !== "string" || !isSqlIdentifierSegment(value)) {
    invalid(path, "must be a SQL identifier");
  }
}

function validateNullableAlias(value: unknown, path: string): void {
  if (value === null) return;
  validateAlias(value, path);
}

function validateLogicalName(value: unknown, path: string): void {
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
    invalid(path, "must be a non-empty logical name");
  }
}

function validateStringArray(value: unknown, path: string): string[] {
  const items = asArray(value, path);
  items.forEach((item, index) => validateLogicalName(item, `${path}[${index}]`));
  return items as string[];
}

function validateColumnNames(value: unknown, path: string): string[] {
  const names = validateStringArray(value, path);
  if (names.length === 0 || new Set(names).size !== names.length) {
    invalid(path, "must be a non-empty list of unique names");
  }
  return names;
}

function sameNames(left: readonly string[], right: unknown): boolean {
  if (!Array.isArray(right) || left.length !== right.length) return false;
  return left.every((name, index) => name === right[index]);
}

function validateValue(value: unknown, path: string): asserts value is Value {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    invalid(path, "number literals must be finite");
  }
  const literal = asRecord(value, path);
  assertKnownKeys(literal, path, ["kind", "value"]);
  if (literal.kind === "date_literal" && isSqlDateLiteral(literal.value as string)) return;
  if (literal.kind === "timestamp_literal" && isSqlTimestampLiteral(literal.value as string)) return;
  if (
    literal.kind === "bigint_literal"
    && typeof literal.value === "string"
    && /^-?(0|[1-9][0-9]*)$/.test(literal.value)
  ) return;
  invalid(path, "is not a supported JSON-compatible SQL literal");
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, "must be an array");
  return value;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      invalid(`${path}.${key}`, "is not a supported property");
    }
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function invalid(path: string, requirement: string): never {
  return userError("INVALID_QUERY_IR", `Invalid Teta Query IR at ${path}: ${requirement}`);
}
