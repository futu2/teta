import { userError } from "../errors.ts";
import type { ExprSqlTarget, QueryIRSqlTarget } from "../renderer_types.ts";
import {
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
  isSqlIdentifierSegment,
  isSqlParameterName,
} from "./tokens.ts";

const BINARY_OPS = new Set<BinaryOp>([
  "=", "!=", "<", "<=", ">", ">=", "AND", "OR", "+", "-", "*", "/", "||",
  "LIKE", "IS", "IS NOT", "IN", "NOT IN", "BETWEEN", "IS DISTINCT FROM",
]);
const JOIN_TYPES = new Set(["INNER", "LEFT", "RIGHT", "FULL"]);
const ORDER_DIRECTIONS = new Set(["ASC", "DESC"]);

/**
 * Decode and validate a versioned query IR target before it reaches the renderer.
 *
 * This is the public ABI boundary for frontends implemented in any language.
 * It intentionally validates runtime shape, SQL tokens, and renderer-required
 * metadata rather than trusting TypeScript's compile-time declarations.
 */
export function validateQueryIR(value: unknown): asserts value is QueryIRSqlTarget {
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
  stages.forEach((stage, index) => validateStage(stage, `${path}.stages[${index}]`));

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

function validateStage(value: unknown, path: string): void {
  const stage = asRecord(value, path);
  switch (stage.kind) {
    case "map":
      assertKnownKeys(stage, path, ["kind", "items", "keys", "groupBy", "outputScopeId"]);
      validateProjectionStage(stage, path, false);
      return;
    case "fold":
      assertKnownKeys(stage, path, ["kind", "items", "keys", "groupBy", "outputScopeId"]);
      validateProjectionStage(stage, path, true);
      return;
    case "filter":
      assertKnownKeys(stage, path, ["kind", "predicate", "projectAll"]);
      validateExprNode(stage.predicate, `${path}.predicate`);
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      return;
    case "sort":
      assertKnownKeys(stage, path, ["kind", "items", "projectAll"]);
      validateOrderItems(stage.items, `${path}.items`);
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      return;
    case "take":
      assertKnownKeys(stage, path, ["kind", "count", "projectAll"]);
      if (!isNonNegativeInteger(stage.count)) invalid(`${path}.count`, "must be a finite non-negative integer");
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      return;
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
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateScope(stage.rightScopeId, `${path}.rightScopeId`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return;
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
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateScope(stage.rightScopeId, `${path}.rightScopeId`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return;
    case "union":
      assertKnownKeys(stage, path, ["kind", "op", "projectAll", "right", "outputScopeId"]);
      if (stage.op !== "union" && stage.op !== "union all") {
        invalid(`${path}.op`, "must be union or union all");
      }
      validateProjectionItems(stage.projectAll, `${path}.projectAll`);
      validateQuerySpec(stage.right, `${path}.right`);
      validateScope(stage.outputScopeId, `${path}.outputScopeId`);
      return;
    default:
      invalid(`${path}.kind`, "is not a supported query stage");
  }
}

function validateProjectionStage(
  stage: Record<string, unknown>,
  path: string,
  isFold: boolean
): void {
  validateProjectionItems(stage.items, `${path}.items`);
  const keys = validateColumnNames(stage.keys, `${path}.keys`);
  const items = asArray(stage.items, `${path}.items`);
  if (keys.length !== items.length) {
    invalid(`${path}.keys`, "must describe every projected item");
  }
  if (isFold) {
    if (stage.groupBy !== null) validateExprArray(stage.groupBy, `${path}.groupBy`);
  } else if (stage.groupBy !== null) {
    invalid(`${path}.groupBy`, "must be null for a map stage");
  }
  validateScope(stage.outputScopeId, `${path}.outputScopeId`);
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

function validateProjectionItems(value: unknown, path: string): void {
  asArray(value, path).forEach((item, index) => {
    const projection = asRecord(item, `${path}[${index}]`);
    assertKnownKeys(projection, `${path}[${index}]`, ["expr", "as"]);
    validateExprNode(projection.expr, `${path}[${index}].expr`);
    validateNullableIdentifier(projection.as, `${path}[${index}].as`);
  });
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

function validateValue(value: unknown, path: string): asserts value is Value {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    invalid(path, "number literals must be finite");
  }
  const literal = asRecord(value, path);
  assertKnownKeys(literal, path, ["kind", "value"]);
  if (
    (literal.kind === "date_literal" || literal.kind === "timestamp_literal")
    && typeof literal.value === "string"
    && literal.value.length > 0
  ) return;
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
