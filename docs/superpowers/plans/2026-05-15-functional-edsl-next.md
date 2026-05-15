# Functional EDSL Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining public class-based SQL EDSL model with immutable tagged values, strict callback row access, fixed join helpers, and clearer module ownership.

**Architecture:** Keep the current callback-only pipeline API, but change the values behind it: `Query`, `Expr`, and `Column` become frozen tagged objects with structural guards. Update primitive query and expression builders first, then remove constructor exports, public generic `join(...)`, and compatibility overload probing. Finish by moving helper modules into a dedicated helper layer while keeping the top-level entrypoint as the stable public surface.

**Tech Stack:** TypeScript 5.9, Bun test runner, `@teta/sql` backend IR and renderer, existing Teta EDSL files under `packages/teta/src/edsl`.

---

## File Structure

- Modify: `packages/teta/src/edsl/core/expr/runtime.ts`
  - Replace `ExprRef`, `ColumnRef`, and `WindowBuilder` classes with tagged value types, factory functions, structural guards, and frozen objects.
- Modify: `packages/teta/src/edsl/core/expr/columns.ts`
  - Build strict row callback proxies with `columnOf(...)`, `isExpr(...)`, and unknown-column errors.
- Modify: `packages/teta/src/edsl/core/expr.ts`
  - Re-export the new expression value API.
- Modify: `packages/teta/src/edsl/sql/expr/**/*.ts`
  - Replace `new ExprRef(...)` expression construction with `exprOf(...)`.
- Modify: `packages/teta/src/edsl/query/builder.ts`
  - Replace the `Query` class with a tagged value type, `queryOf(...)`, `isQuery(...)`, and query-state access helpers.
  - Remove public generic `join(...)` export and remove legacy overload probing.
- Modify: `packages/teta/src/edsl/query/schema.ts`
  - Continue producing typed query roots through `createQuery(...)`; no public constructor use remains.
- Modify: `packages/teta/src/edsl/query/extend.ts`
  - Remove `instanceof Query` data-first detection and validate only the current curried API shape.
- Modify: `packages/teta/src/edsl/query/select.ts`
  - Replace `instanceof Query` and `instanceof ExprRef` checks with structural guards.
- Modify: `packages/teta/src/edsl/query/filter_comparison.ts`
  - Replace `instanceof ExprRef` checks with `isExpr(...)`.
- Modify: `packages/teta/src/edsl/query/utils.ts`
  - Replace direct `ColumnRef` construction with `columnOf(...)`.
- Modify: `packages/teta/src/edsl/query.ts`
  - Stop exporting public `join(...)`; add exports for `isQuery`.
- Modify: `packages/teta/src/edsl/expr.ts`
  - Export `Expr`, `Column`, `isExpr`, and `isColumn`; keep internal aliases only where needed during migration.
- Modify: `packages/teta/mod.ts`
  - Remove `export const Query` and `export const ExprRef`; export types and guards instead.
- Modify: `packages/teta/README.md`, `doc/TUTORIAL.md`, `doc/cheatsheet.md`, `doc/TYPES.md`, `doc/LANGUAGE_SPEC.md`
  - Remove public `join(...)`, constructor-value, and `ExprRef` wording from examples.
- Create: `packages/teta/tests/value_model.test.ts`
  - Runtime tests for tagged values, immutability, guards, node conversion, and unknown column access.
- Modify: `packages/teta/tests/typecheck.ts`
  - Replace public `ExprRef` type usage with `Expr`, and replace `join(...)` examples with fixed join helpers.
- Modify: `packages/teta/tests/callback_column_api.test.ts`
  - Replace direct `new ExprRef(...)` invalid-node test setup with malformed tagged objects.
- Modify: existing query/rendering tests under `packages/teta/tests/*.test.ts`
  - Replace public `join(...)` imports/usages with fixed helper equivalents.

## Task 1: Add Tagged Expression Values

**Files:**
- Modify: `packages/teta/src/edsl/core/expr/runtime.ts`
- Test: `packages/teta/tests/value_model.test.ts`

- [ ] **Step 1: Write failing expression value-model tests**

Add this new file:

```ts
import { describe, expect, test } from "bun:test";
import {
  eq,
  isColumn,
  isExpr,
  lit,
  table,
  t,
  toSql,
  filter,
  pipe,
} from "../mod.ts";
import { toExprNode } from "../src/edsl/expr.ts";

describe("tagged EDSL value model", () => {
  test("creates immutable tagged expressions", () => {
    const expr = lit(1);

    expect(expr.kind).toBe("expr");
    expect(isExpr(expr)).toBe(true);
    expect(isColumn(expr)).toBe(false);
    expect(Object.isFrozen(expr)).toBe(true);
    expect(toExprNode(expr)).toEqual({ kind: "literal", value: 1 });
  });

  test("creates immutable tagged column expressions", () => {
    const users = table("users", {
      id: t.int(),
      name: t.string(),
    });

    const id = users.columns.id;

    expect(id.kind).toBe("column");
    expect(isExpr(id)).toBe(true);
    expect(isColumn(id)).toBe(true);
    expect(Object.isFrozen(id)).toBe(true);
    expect(id.name).toBe("id");
  });

  test("rejects malformed expression-like values", () => {
    expect(isExpr({ kind: "expr", node: null })).toBe(false);
    expect(() => toExprNode({ kind: "expr", node: null } as any)).toThrow(
      "Unsupported literal value"
    );
  });

  test("tagged expressions still render through query helpers", () => {
    const users = table("users", {
      id: t.int(),
    });

    const query = pipe(users, filter((user) => eq(user.id, lit(1))));

    expect(toSql(query, { dialect: "postgresql", format: "compact" })).toBe(
      "SELECT users_0.id AS id FROM users AS users_0 WHERE users_0.id = 1"
    );
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts
```

Expected: FAIL because `isExpr`, `isColumn`, and tagged `kind` fields do not exist yet.

- [ ] **Step 3: Replace expression classes with tagged values**

In `packages/teta/src/edsl/core/expr/runtime.ts`, replace the class definitions with these types and factories:

```ts
export type Expr<T> = Readonly<{
  kind: "expr";
  node: ExprNode<T>;
}>;

export type ExprRef<T> = Expr<T>;

export type ColumnTableRef = ScopeId | typeof OUTER_TABLE_ALIAS | null;

export type Column<T, Name extends string> = Readonly<{
  kind: "column";
  node: ExprNode<T>;
  table: ColumnTableRef;
  name: Name;
}>;

export type ColumnRef<T, Name extends string> = Column<T, Name>;

export type WindowExpr<T> = Readonly<{
  kind: "window_builder";
  name: string;
  args: readonly ExprNode<unknown>[];
  readonly __valueType?: T;
}>;

export type WindowBuilder<T> = WindowExpr<T>;

export function exprOf<T>(node: ExprNode<T>): Expr<T> {
  return Object.freeze({ kind: "expr" as const, node });
}

export function columnOf<T, Name extends string>(
  table: ColumnTableRef,
  name: Name
): Column<T, Name> {
  return Object.freeze({
    kind: "column" as const,
    node: { kind: "column", table, name } as ExprNode<T>,
    table,
    name,
  });
}

export function windowBuilderOf<T>(
  name: string,
  args: readonly ExprNode<unknown>[]
): WindowBuilder<T> {
  return Object.freeze({ kind: "window_builder" as const, name, args: [...args] });
}

export function isExpr(value: unknown): value is Expr<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; node?: unknown };
  return (
    (candidate.kind === "expr" || candidate.kind === "column") &&
    isExprNode(candidate.node)
  );
}

export function isColumn(value: unknown): value is Column<unknown, string> {
  if (!isExpr(value)) return false;
  const candidate = value as { kind?: unknown; table?: unknown; name?: unknown };
  return candidate.kind === "column" && typeof candidate.name === "string";
}

function isExprNode(value: unknown): value is ExprNode<unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown };
  return typeof candidate.kind === "string";
}
```

Then replace expression constructors in the same file:

```ts
export function lit<T extends Value>(value: T): Expr<T> {
  return exprOf<T>({ kind: "literal", value });
}

export function param<T>(value: T, name: string | null = null): Expr<T> {
  if (value === undefined) {
    userError("INVALID_PARAM_VALUE", "Unsupported parameter value: undefined");
  }
  if (name !== null && !name.trim()) {
    userError("INVALID_PARAM_NAME", "param name cannot be empty");
  }
  return exprOf<T>({ kind: "param", value, name });
}

export function array<T = unknown>(...values: ExprInput<T>[]): Expr<T[]> {
  return exprOf<T[]>({
    kind: "array",
    items: values.map((value) => toExprNode(value)),
  });
}

export function wrapExpr<T>(value: ExprInput<T>): Expr<T> {
  if (isExpr(value)) return value as Expr<T>;
  return exprOf<T>(toExprNode(value));
}

export function toExprNode<T>(value: ExprInput<T>): ExprNode<T> {
  if (isExpr(value)) return value.node as ExprNode<T>;
  if (value === undefined) {
    userError("INVALID_LITERAL_VALUE", "Unsupported literal value: undefined");
  }
  if (value === null) return { kind: "literal", value: null };
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "bigint") {
    return { kind: "literal", value: value as Value } as ExprNode<T>;
  }
  if (isTemporalLiteral(value)) {
    return { kind: "literal", value } as ExprNode<T>;
  }
  userError("INVALID_LITERAL_VALUE", `Unsupported literal value: ${String(value)}`);
}
```

Use `exprOf(...)` in `aggregateExpr`, `over`, `binaryExpr`, and `funcExpr`, and use `windowBuilderOf(...)` in `windowFn` and `windowExpr`.

- [ ] **Step 4: Replace expression construction outside runtime.ts**

Search:

```bash
rg -n "new ExprRef|new ColumnRef|new WindowBuilder|instanceof ExprRef" packages/teta/src
```

Replace every `new ExprRef<T>(node)` with `exprOf<T>(node)`, every `new ColumnRef<T, Name>(table, name)` with `columnOf<T, Name>(table, name)`, and every `value instanceof ExprRef` with `isExpr(value)`.

Representative replacements:

```ts
// Before
return new ExprRef<T | null>({ kind: "cast", expr: toExprNode(value), dataType });

// After
return exprOf<T | null>({ kind: "cast", expr: toExprNode(value), dataType });
```

```ts
// Before
const leftRef = leftValue instanceof ExprRef ? leftValue : undefined;

// After
const leftRef = isExpr(leftValue) ? leftValue : undefined;
```

- [ ] **Step 5: Run expression-focused tests**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts packages/teta/tests/functional_builders.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit expression value model**

Run:

```bash
git add packages/teta/src/edsl/core/expr/runtime.ts packages/teta/src/edsl/core/expr/columns.ts packages/teta/src/edsl/sql/expr packages/teta/src/edsl/query/filter_comparison.ts packages/teta/src/edsl/query/select.ts packages/teta/src/edsl/query/utils.ts packages/teta/tests/value_model.test.ts
git commit -m "refactor: use tagged expression values"
```

## Task 2: Add Tagged Query Values

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query/schema.ts`
- Modify: `packages/teta/src/edsl/query/extend.ts`
- Test: `packages/teta/tests/value_model.test.ts`

- [ ] **Step 1: Extend failing tests for query values**

Append to `packages/teta/tests/value_model.test.ts`:

```ts
import { isQuery } from "../mod.ts";

test("creates immutable tagged queries", () => {
  const users = table("users", {
    id: t.int(),
  });

  expect(users.kind).toBe("query");
  expect(isQuery(users)).toBe(true);
  expect(Object.isFrozen(users)).toBe(true);
  expect(Object.isFrozen(users.state)).toBe(true);
  expect(users.columnNames).toEqual(["id"]);
});
```

- [ ] **Step 2: Run the query value test and verify it fails**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts
```

Expected: FAIL because `isQuery` and `kind: "query"` do not exist yet.

- [ ] **Step 3: Replace the `Query` class with a tagged value type**

In `packages/teta/src/edsl/query/builder.ts`, replace the exported class with:

```ts
export type Query<TColumns extends QueryColumns> = Readonly<QueryState<TColumns> & {
  kind: "query";
  state: Readonly<QueryState<TColumns>>;
}>;

export function isQuery(value: unknown): value is Query<QueryColumns> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; state?: unknown };
  return candidate.kind === "query" && isQueryState(candidate.state);
}

function isQueryState(value: unknown): value is QueryState<QueryColumns> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<QueryState<QueryColumns>>;
  return (
    candidate.source !== undefined &&
    Array.isArray(candidate.stages) &&
    candidate.columns !== undefined &&
    Array.isArray(candidate.columnNames) &&
    typeof candidate.sourceScopeId === "string" &&
    typeof candidate.scopeId === "string"
  );
}

function queryOf<TColumns extends QueryColumns>(
  state: QueryState<TColumns>
): Query<TColumns> {
  const frozenState = Object.freeze({
    ...state,
    stages: Object.freeze([...state.stages]),
    columnNames: Object.freeze([...state.columnNames]),
    withs: Object.freeze([...(state.withs ?? [])]),
    columnIdentifiers: Object.freeze({ ...state.columnIdentifiers }),
  });

  return Object.freeze({
    kind: "query" as const,
    state: frozenState,
    source: frozenState.source,
    stages: frozenState.stages,
    columns: frozenState.columns,
    columnNames: frozenState.columnNames,
    sourceScopeId: frozenState.sourceScopeId,
    scopeId: frozenState.scopeId,
    withs: frozenState.withs,
    columnIdentifiers: frozenState.columnIdentifiers,
  });
}
```

Then update `createQuery(...)`:

```ts
export function createQuery<TColumns extends QueryColumns>(
  init: QueryInit<TColumns>
): Query<TColumns> {
  return queryOf(resolveQueryInitDefaults(init));
}
```

- [ ] **Step 4: Replace query `instanceof` checks**

Search:

```bash
rg -n "instanceof Query|new Query" packages/teta/src packages/teta/mod.ts
```

Replace with `isQuery(...)` checks. In `extend(...)`, remove data-first detection entirely:

```ts
export function extend(...args: unknown[]): unknown {
  if (args.length !== 1 || typeof args[0] !== "function") {
    userError("QUERY_HELPER_INVALID_SELECTOR", "extend() expects a row callback");
  }

  const selector = args[0] as (cols: ColumnRefs<QueryColumns>) => ProjectionShape;
  return (query: Query<QueryColumns>) => {
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...currentColumns(cols, query.columnNames),
      ...resolveExtensionShape(selector(cols)),
    }))(query);
  };
}
```

In `builder.ts`, make `assertNotDataFirstQueryHelper(...)` a current-shape arity validator:

```ts
function assertCurriedArgs(helper: string, usage: string, args: unknown[], expected: number): void {
  if (args.length !== expected) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}
```

Use it in `map`, `fold`, `filter`, `sort`, `take`, `union`, `unionAll`, and `loop`.

- [ ] **Step 5: Run query value tests**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts packages/teta/tests/query_functional.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit query value model**

Run:

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/src/edsl/query/schema.ts packages/teta/src/edsl/query/extend.ts packages/teta/tests/value_model.test.ts
git commit -m "refactor: use tagged query values"
```

## Task 3: Make Row Callback Proxies Strict

**Files:**
- Modify: `packages/teta/src/edsl/core/expr/columns.ts`
- Test: `packages/teta/tests/value_model.test.ts`

- [ ] **Step 1: Write failing unknown-column tests**

Append to `packages/teta/tests/value_model.test.ts`:

```ts
test("throws when untyped code accesses an unknown callback column", () => {
  const users = table("users", {
    id: t.int(),
    name: t.string(),
  });

  expect(() => {
    pipe(
      users,
      filter((row) => eq((row as any).missing, 1))
    );
  }).toThrow("Unknown column 'missing'. Available columns: id, name.");
});
```

- [ ] **Step 2: Run the strict-column test and verify it fails**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts
```

Expected: FAIL because the proxy currently creates a column for any string property.

- [ ] **Step 3: Reject unknown properties in `createColumnRefs(...)`**

In `packages/teta/src/edsl/core/expr/columns.ts`, add:

```ts
import { userError } from "../../errors.ts";

function assertKnownColumn(name: string, columns: readonly string[]): void {
  if (columns.includes(name)) return;
  userError(
    "UNKNOWN_COLUMN_REF",
    `Unknown column '${name}'. Available columns: ${columns.join(", ")}.`
  );
}
```

Update the `get` trap in `createColumnRefs(...)`:

```ts
get(_target, prop) {
  if (typeof prop !== "string") return undefined;
  if (prop === "then" || prop === "toJSON" || prop === "inspect") return undefined;
  assertKnownColumn(prop, columns);
  return getColumn(prop);
}
```

Update `getColumn(...)` to use the tagged factory:

```ts
const next = columnOf<unknown, string>(tableName, name);
```

Apply the same known-column behavior to `mergeColumnRefs(...)`, using `mergedKeys` for validation.

- [ ] **Step 4: Run strict-column tests**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts packages/teta/tests/query_functional.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit strict row callback access**

Run:

```bash
git add packages/teta/src/edsl/core/expr/columns.ts packages/teta/tests/value_model.test.ts
git commit -m "fix: reject unknown callback columns"
```

## Task 4: Remove Public Generic `join(...)`

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`
- Modify: other `packages/teta/tests/*.test.ts` files found by search

- [ ] **Step 1: Find current public `join(...)` usage**

Run:

```bash
rg -n "\\bjoin\\(" packages/teta/tests packages/teta/README.md doc examples packages/teta/mod.ts packages/teta/src/edsl/query.ts
```

Expected: output includes `typecheck.ts`, `mod.ts`, and any docs/examples that still import or call `join(...)`.

- [ ] **Step 2: Replace tests with fixed join helpers**

In `packages/teta/tests/typecheck.ts`, replace:

```ts
const leftViaJoin = pipe(users, join(
    orders,
    (user, order) => eq(user.id, order.user_id),
    { type: "left" }
));
```

with:

```ts
const leftViaJoin = pipe(users, leftJoin(
    orders,
    (user, order) => eq(user.id, order.user_id)
));
```

Replace:

```ts
const usingJoin = pipe(users, join(
    profileRows,
    usingCols("id"),
    dropOverlapLeft()
));
```

with:

```ts
const usingJoin = pipe(users, innerJoinMerge(
    profileRows,
    usingCols("id"),
    dropOverlapLeft()
));
```

Remove `join` from the import list in that file.

- [ ] **Step 3: Remove public `join(...)` exports**

In `packages/teta/src/edsl/query.ts`, remove `join` from the export list. In `packages/teta/mod.ts`, remove:

```ts
/** Joins two query inputs with an explicit join condition. */
export const join: typeof import("./src/edsl/query.ts").join = query.join;
```

Keep the internal `buildJoin(...)` function in `builder.ts` because fixed helpers still use it.

- [ ] **Step 4: Remove generic public overload implementation**

In `packages/teta/src/edsl/query/builder.ts`, delete the exported `join(...)` overloads and implementation. Keep `_join(...)`, `buildJoin(...)`, fixed helper overloads, and fixed helper implementations.

- [ ] **Step 5: Run join-related tests**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts packages/teta/tests/typecheck.ts
```

Expected: PASS.

- [ ] **Step 6: Commit generic join removal**

Run:

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts packages/teta/tests
git commit -m "refactor: remove public generic join helper"
```

## Task 5: Remove Constructor Exports and Update Public Types

**Files:**
- Modify: `packages/teta/mod.ts`
- Modify: `packages/teta/src/edsl/expr.ts`
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/public_api.test.ts`
- Modify: `packages/teta/tests/callback_column_api.test.ts`
- Test: `packages/teta/tests/value_model.test.ts`

- [ ] **Step 1: Write failing public API tests**

Append to `packages/teta/tests/value_model.test.ts`:

```ts
import * as publicApi from "../mod.ts";

test("does not export public constructor values", () => {
  expect("Query" in publicApi).toBe(false);
  expect("ExprRef" in publicApi).toBe(false);
  expect(typeof publicApi.isQuery).toBe("function");
  expect(typeof publicApi.isExpr).toBe("function");
  expect(typeof publicApi.isColumn).toBe("function");
});
```

- [ ] **Step 2: Run the public API test and verify it fails**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts packages/teta/tests/public_api.test.ts
```

Expected: FAIL because constructor values are still exported.

- [ ] **Step 3: Update top-level public exports**

In `packages/teta/mod.ts`, remove:

```ts
export const Query: typeof import("./src/edsl/query.ts").Query = query.Query;
export const ExprRef: typeof import("./src/edsl/expr.ts").ExprRef = expr.ExprRef;
```

Replace the public type exports with:

```ts
export type Query<TColumns extends Record<string, any>> = import("./src/edsl/query.ts").Query<TColumns>;
export type Expr<T> = import("./src/edsl/expr.ts").Expr<T>;
export type Column<T, Name extends string> = import("./src/edsl/expr.ts").Column<T, Name>;

/** Returns true when a value is a Teta query. */
export const isQuery: typeof import("./src/edsl/query.ts").isQuery = query.isQuery;

/** Returns true when a value is a Teta expression. */
export const isExpr: typeof import("./src/edsl/expr.ts").isExpr = expr.isExpr;

/** Returns true when a value is a Teta column expression. */
export const isColumn: typeof import("./src/edsl/expr.ts").isColumn = expr.isColumn;
```

- [ ] **Step 4: Replace public `ExprRef` type usage in tests**

In `packages/teta/tests/typecheck.ts`, replace:

```ts
import type { ExprRef, SqlBigInt, ... } from "../mod.ts";
type ExprType<TExpr> = TExpr extends ExprRef<infer TValue> ? TValue : never;
const mappedProfileOnEq: (user: typeof users.columns, profile: typeof mappedProfileRows.columns) => ExprRef<boolean> = onEq({ id: "user_id" });
```

with:

```ts
import type { Expr, SqlBigInt, ... } from "../mod.ts";
type ExprType<TExpr> = TExpr extends Expr<infer TValue> ? TValue : never;
const mappedProfileOnEq: (user: typeof users.columns, profile: typeof mappedProfileRows.columns) => Expr<boolean> = onEq({ id: "user_id" });
```

- [ ] **Step 5: Replace invalid-node tests that instantiate `ExprRef`**

In `packages/teta/tests/callback_column_api.test.ts`, replace `new ExprRef(...)` invalid cases with tagged malformed objects:

```ts
const invalidNodes = [
  { kind: "expr", node: undefined },
  { kind: "expr", node: null },
  { kind: "expr", node: "bad" },
  { kind: "expr", node: { kind: "bogus" } },
  { kind: "expr", node: { kind: "column" } },
] as any[];
```

Keep the surrounding test assertions unchanged so the validator still proves invalid node shapes fail.

- [ ] **Step 6: Run public API and type tests**

Run:

```bash
bun test packages/teta/tests/value_model.test.ts packages/teta/tests/public_api.test.ts packages/teta/tests/callback_column_api.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit public API cleanup**

Run:

```bash
git add packages/teta/mod.ts packages/teta/src/edsl/expr.ts packages/teta/tests/value_model.test.ts packages/teta/tests/typecheck.ts packages/teta/tests/public_api.test.ts packages/teta/tests/callback_column_api.test.ts
git commit -m "refactor: remove public edsl constructors"
```

## Task 6: Simplify Current-API Runtime Validation

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query/extend.ts`
- Modify: `packages/teta/src/edsl/query/select.ts`
- Test: `packages/teta/tests/errors.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add tests to `packages/teta/tests/errors.test.ts`:

```ts
test("query helpers validate only current curried shapes", () => {
  expect(() => (map as any)()).toThrow("map() expects map(selector)");
  expect(() => (filter as any)("not a callback")).toThrow("filter() expects a row callback");
  expect(() => (take as any)()).toThrow("take() expects take(count)");
});

test("fixed join helpers reject invalid options without probing callbacks", () => {
  const users = table("users", { id: t.int() });
  const orders = table("orders", { user_id: t.int() });
  const on = (_user: typeof users.columns, _order: typeof orders.columns) => {
    throw new Error("callback should not be executed during argument validation");
  };

  expect(() => (leftJoin as any)(users, on, { type: "left" })).toThrow(
    "leftJoin() options must be { lateral?: boolean }"
  );
});
```

- [ ] **Step 2: Run validation tests and verify failures**

Run:

```bash
bun test packages/teta/tests/errors.test.ts
```

Expected: FAIL until helper validation messages and join parsing are simplified.

- [ ] **Step 3: Delete retired overload-probing functions**

In `packages/teta/src/edsl/query/builder.ts`, remove:

```ts
assertNotDataFirstQueryHelper(...)
assertNotDataFirstJoinInvocation(...)
DATA_FIRST_JOIN_INVOCATION
parseCurriedJoinInvocation(...)
parseJoinMergeAndOptions(...)
isJoinMergeShape(...)
isJoinOptionsShape(...)
assertNoLegacyJoinMergeOption(...)
isFixedJoinLegacyMergeArgument(...)
hasLegacyJoinMergeOption(...)
fixedJoinLegacyMergeError(...)
```

Keep fixed join parsers, but make them direct:

```ts
function parseFixedJoinInvocation(
  args: unknown[],
  helper: string
): ParsedCurriedJoinInvocation {
  if (args.length !== 2 && args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, options?)`);
  }
  const [right, on, options] = args;
  assertRowCallback(helper, on);
  assertFixedJoinOptions(helper, options);
  return { right, on, merge: undefined, options };
}

function parseFixedJoinMapInvocation(
  args: unknown[],
  helper: string
): ParsedCurriedJoinInvocation {
  if (args.length !== 3) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${helper}(right, on, selector)`);
  }
  const [right, on, merge] = args;
  assertRowCallback(helper, on);
  assertRowCallback(helper, merge);
  return { right, on, merge, options: undefined };
}
```

- [ ] **Step 4: Run validation and query tests**

Run:

```bash
bun test packages/teta/tests/errors.test.ts packages/teta/tests/query_functional.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validation simplification**

Run:

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/src/edsl/query/extend.ts packages/teta/src/edsl/query/select.ts packages/teta/tests/errors.test.ts
git commit -m "refactor: simplify query helper validation"
```

## Task 7: Move Convenience Helpers Into a Helper Layer

**Files:**
- Create: `packages/teta/src/edsl/helpers/projection.ts`
- Create: `packages/teta/src/edsl/helpers/filter_comparison.ts`
- Create: `packages/teta/src/edsl/helpers/join_merge.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Move projection helper exports**

Move the contents of `packages/teta/src/edsl/query/projection_helpers.ts` to `packages/teta/src/edsl/helpers/projection.ts`.

Leave this compatibility-free internal re-export at `packages/teta/src/edsl/query/projection_helpers.ts` while local imports are updated:

```ts
export { drop, pick, rename } from "../helpers/projection.ts";
```

- [ ] **Step 2: Move filter comparison helpers**

Move the contents of `packages/teta/src/edsl/query/filter_comparison.ts` to `packages/teta/src/edsl/helpers/filter_comparison.ts`.

Leave this internal re-export:

```ts
export {
  filterEq,
  filterNe,
  filterGt,
  filterGte,
  filterLt,
  filterLte,
} from "../helpers/filter_comparison.ts";
```

- [ ] **Step 3: Move join merge helpers**

Move helper-only join exports from `packages/teta/src/edsl/query/join.ts` to `packages/teta/src/edsl/helpers/join_merge.ts`:

```ts
usingCols
onEq
prefixOverlapLeft
prefixOverlapRight
prefixAllLeft
prefixAllRight
suffixAllLeft
suffixAllRight
dropOverlapLeft
dropOverlapRight
```

Leave query join types that are required by `builder.ts` in `query/join.ts`. Import helper functions from `../helpers/join_merge.ts` where public exports need them.

- [ ] **Step 4: Update `query.ts` exports**

In `packages/teta/src/edsl/query.ts`, export primitive query steps from query modules and helper functions from helper modules:

```ts
export {
  filterEq,
  filterNe,
  filterGt,
  filterGte,
  filterLt,
  filterLte,
} from "./helpers/filter_comparison.ts";
export { drop, pick, rename } from "./helpers/projection.ts";
export {
  dropOverlapLeft,
  dropOverlapRight,
  onEq,
  prefixAllLeft,
  prefixAllRight,
  prefixOverlapLeft,
  prefixOverlapRight,
  suffixAllLeft,
  suffixAllRight,
  usingCols,
} from "./helpers/join_merge.ts";
```

- [ ] **Step 5: Run focused helper tests**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts packages/teta/tests/callback_column_api.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit helper module split**

Run:

```bash
git add packages/teta/src/edsl/helpers packages/teta/src/edsl/query.ts packages/teta/src/edsl/query packages/teta/mod.ts
git commit -m "refactor: split edsl helper layer"
```

## Task 8: Update Docs and Examples

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TYPES.md`
- Modify: `doc/LANGUAGE_SPEC.md`
- Modify: `examples/**/*.ts`

- [ ] **Step 1: Search outdated public API docs**

Run:

```bash
rg -n "ExprRef|new Query|new ExprRef|\\bjoin\\(|import \\{[^}]*join|export const Query|export const ExprRef" packages/teta/README.md doc examples packages/teta/tests
```

Expected: output lists every remaining public-facing outdated mention.

- [ ] **Step 2: Replace outdated examples**

Use these replacements consistently:

```ts
// Before
import { join } from "@teta/teta";
pipe(users, join(orders, onEq({ id: "user_id" }), { type: "left" }));

// After
import { leftJoin } from "@teta/teta";
pipe(users, leftJoin(orders, onEq({ id: "user_id" })));
```

```ts
// Before
import type { ExprRef } from "@teta/teta";

// After
import type { Expr } from "@teta/teta";
```

Describe values as "tagged query and expression values" rather than classes.

- [ ] **Step 3: Run docs/example checks**

Run:

```bash
bun run check:metadata
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit docs and examples**

Run:

```bash
git add packages/teta/README.md doc examples packages/teta/tests
git commit -m "docs: update functional edsl public api"
```

## Task 9: Full Verification

**Files:**
- No planned source edits unless verification reveals a concrete failure.

- [ ] **Step 1: Run package tests**

Run:

```bash
bun run --cwd packages/teta test
```

Expected: PASS.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 3: Run repository check**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 4: Check for retired patterns**

Run:

```bash
rg -n "new ExprRef|new ColumnRef|new WindowBuilder|new Query|instanceof ExprRef|instanceof Query|export const Query|export const ExprRef|\\bjoin\\(" packages/teta/src packages/teta/mod.ts packages/teta/tests packages/teta/README.md doc examples
```

Expected: no matches for constructor exports, constructors, `instanceof` checks, or public `join(...)` usage. Matches for internal `buildJoin(...)`, fixed helpers such as `leftJoin(...)`, or prose containing "join helpers" are acceptable.

- [ ] **Step 5: Commit verification fixes if needed**

If Step 1, 2, 3, or 4 required edits, run:

```bash
git add packages/teta doc examples
git commit -m "fix: complete functional edsl migration"
```

Expected: commit is created only when verification required changes.
