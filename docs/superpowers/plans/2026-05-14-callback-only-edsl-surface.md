# Callback-Only EDSL Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove deferred column-reference APIs from the public EDSL surface and reshape joins/helpers around callback-only, fixed positional functional composition.

**Architecture:** This is phase 1 of the functional EDSL redesign. It removes `col(...)`, `leftCol(...)`, `rightCol(...)`, deferred selection overloads, and ambiguous join overloads while preserving the current renderer and callback-based query construction. The public `Query` and `ExprRef` class-to-tagged-record rewrite is intentionally left for a follow-up plan after this surface is stable.

**Tech Stack:** TypeScript 5.9, Bun test runner, existing `@teta/teta` EDSL and `@teta/sql` renderer.

---

## File Map

- Modify `packages/teta/src/edsl/core/expr.ts`: stop re-exporting deferred column helpers.
- Modify `packages/teta/src/edsl/core/expr/runtime.ts`: remove deferred dependency phantom types from the public expression runtime.
- Delete `packages/teta/src/edsl/core/expr/deferred.ts`: no public or query code should import it after this plan.
- Modify `packages/teta/src/edsl/query/builder.ts`: make `filter`, `map`, `fold`, `sort`, `unnest`, and joins callback-only where they currently accept deferred expressions or selection objects.
- Modify `packages/teta/src/edsl/query/extend.ts`: make `extend` callback-only.
- Modify `packages/teta/src/edsl/query/select.ts`: keep callback-only `select((row) => [...])` and remove direct array selection support.
- Modify `packages/teta/src/edsl/query/filter_comparison.ts`: make comparison filter helpers accept callback operands or literals only.
- Modify `packages/teta/src/edsl/query/join.ts`: keep callback-based `usingCols`, `onEq`, and merge helpers; add fixed mapped/merged join helper types used by `builder.ts`.
- Modify `packages/teta/src/edsl/query.ts`: export the new callback-only query helper surface.
- Modify `packages/teta/mod.ts`: remove public exports for `col`, `leftCol`, `rightCol`, deferred dependency types, and any removed list-style `select` helpers.
- Modify docs: `packages/teta/README.md`, `doc/TUTORIAL.md`, `doc/cheatsheet.md`, `doc/TYPES.md`, `doc/DEV_GUIDE.md`.
- Modify examples and benchmarks under `examples/` and `benchmarks/` that import or call removed helpers.
- Modify tests: `packages/teta/tests/typecheck.ts`, `packages/teta/tests/query_functional.test.ts`, `packages/teta/tests/deferred_proxy.test.ts`, `packages/teta/tests/public_entrypoint.test.ts`, `packages/teta/tests/core_exports.test.ts`, and other tests found by `rg '\bcol\(|leftCol|rightCol|select\(|alias\(' packages/teta`.

---

### Task 1: Lock Public Removal Tests

**Files:**
- Modify: `packages/teta/tests/core_exports.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add runtime public-entrypoint assertions**

In `packages/teta/tests/core_exports.test.ts`, extend the existing `"does not export proxy shorthand column refs"` test so it also rejects deferred refs:

```ts
  test("does not export proxy or deferred shorthand column refs", () => {
    expect("$" in teta).toBe(false);
    expect("$left" in teta).toBe(false);
    expect("$right" in teta).toBe(false);
    expect("col" in teta).toBe(false);
    expect("leftCol" in teta).toBe(false);
    expect("rightCol" in teta).toBe(false);
  });
```

Replace the old test body rather than adding a duplicate test with the same intent.

- [ ] **Step 2: Add type-level removed-export checks**

Add `publicApi` to the imports at the top of `packages/teta/tests/typecheck.ts`:

```ts
import * as publicApi from "../mod.ts";
```

At the bottom of the file, add these checks:

```ts
// @ts-expect-error col is removed from the public API
publicApi.col;
// @ts-expect-error leftCol is removed from the public API
publicApi.leftCol;
// @ts-expect-error rightCol is removed from the public API
publicApi.rightCol;
```

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
bun test packages/teta/tests/core_exports.test.ts
bun run --cwd packages/teta typecheck
```

Expected:

- `core_exports.test.ts` fails because `col`, `leftCol`, and `rightCol` are still exported.
- `typecheck` fails because the new `@ts-expect-error` comments are unused while the exports still exist.

- [ ] **Step 4: Commit failing tests**

```bash
git add packages/teta/tests/core_exports.test.ts packages/teta/tests/typecheck.ts
git commit -m "test: lock removal of deferred column refs"
```

---

### Task 2: Remove Deferred Public Exports

**Files:**
- Modify: `packages/teta/src/edsl/core/expr.ts`
- Modify: `packages/teta/mod.ts`
- Modify: `packages/teta/tests/core_exports.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Stop re-exporting deferred helpers from the expression barrel**

In `packages/teta/src/edsl/core/expr.ts`, remove this line:

```ts
export * from "./expr/deferred.ts";
```

Keep all other expression exports intact for now.

- [ ] **Step 2: Remove public deferred exports from `mod.ts`**

In `packages/teta/mod.ts`, delete these exported const/type declarations:

```ts
export type DeferredExprDeps = import("./src/edsl/expr.ts").DeferredExprDeps;
export type DeferredExprDepsForArgs<TItems extends readonly unknown[]> = import("./src/edsl/expr.ts").DeferredExprDepsForArgs<TItems>;
export type DeferredExprDepsOf<TExpr> = import("./src/edsl/expr.ts").DeferredExprDepsOf<TExpr>;
export type DeferredExprDepScope = import("./src/edsl/expr.ts").DeferredExprDepScope;
export type EmptyDeferredExprDeps = import("./src/edsl/expr.ts").EmptyDeferredExprDeps;
export const col: typeof import("./src/edsl/expr.ts").col = expr.col;
export const leftCol: typeof import("./src/edsl/expr.ts").leftCol = expr.leftCol;
export const rightCol: typeof import("./src/edsl/expr.ts").rightCol = expr.rightCol;
```

Also change the public `ExprRef` type alias from:

```ts
export type ExprRef<
  T,
  TDeps extends import("./src/edsl/expr.ts").DeferredExprDeps = import("./src/edsl/expr.ts").EmptyDeferredExprDeps,
> = import("./src/edsl/expr.ts").ExprRef<T, TDeps>;
```

to:

```ts
export type ExprRef<T> = import("./src/edsl/expr.ts").ExprRef<T>;
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
bun test packages/teta/tests/core_exports.test.ts
bun run --cwd packages/teta typecheck
```

Expected:

- `core_exports.test.ts` passes its removed-export assertions.
- `typecheck` still fails because many in-repo examples import and use removed deferred helpers.

- [ ] **Step 4: Commit export removal**

```bash
git add packages/teta/src/edsl/core/expr.ts packages/teta/mod.ts packages/teta/tests/core_exports.test.ts packages/teta/tests/typecheck.ts
git commit -m "refactor: remove deferred column ref exports"
```

---

### Task 3: Convert Tests From Deferred Refs To Callbacks

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`
- Modify: `packages/teta/tests/deferred_proxy.test.ts`
- Modify other test files found by `rg '\bcol\(|leftCol|rightCol|select\(|alias\(' packages/teta/tests`

- [ ] **Step 1: Find all removed helper usages in tests**

Run:

```bash
rg -n '\bcol\(|leftCol|rightCol|select\(|alias\(' packages/teta/tests
```

Expected: output lists every test call site that must be converted or deleted.

- [ ] **Step 2: Convert current-row deferred calls to callbacks**

Apply these mechanical replacements in tests:

```ts
filter(eq(col("id"), 1))
```

becomes:

```ts
filter((row) => eq(row.id, 1))
```

```ts
map({ id: col("id"), name: upper(col("name")) })
```

becomes:

```ts
map((row) => ({ id: row.id, name: upper(row.name) }))
```

```ts
sort([asc(col("name")), desc(col("id"))])
```

becomes:

```ts
sort((row) => [asc(row.name), desc(row.id)])
```

```ts
fold({ user_id: group(col("user_id")), total_spend: sum(col("total")) })
```

becomes:

```ts
fold((row) => ({ user_id: group(row.user_id), total_spend: sum(row.total) }))
```

```ts
unnest(col("tags"), { value: "tag" })
```

becomes:

```ts
unnest((row) => row.tags, { value: "tag" })
```

- [ ] **Step 3: Convert join deferred calls to join callbacks**

Replace:

```ts
leftJoin(
  orders,
  eq(leftCol("id"), rightCol("user_id")),
  {
    user_id: leftCol("id"),
    total: rightCol("total"),
  }
)
```

with the mapped join helper form that this phase will implement:

```ts
leftJoinMap(
  orders,
  (user, order) => eq(user.id, order.user_id),
  (user, order) => ({
    user_id: user.id,
    total: order.total,
  })
)
```

This test conversion depends on Task 5. Do not run the full typecheck as a success gate until Task 5 has added `leftJoinMap`.

- [ ] **Step 4: Remove deferred-only runtime tests**

In `packages/teta/tests/deferred_proxy.test.ts`, remove tests whose only purpose is validating deferred refs, including tests named like:

```ts
test("creates deferred column expressions", ...)
test("rejects unknown deferred current columns", ...)
test("rejects deferred join scope misuse", ...)
```

Keep tests that validate behavior still supported through callbacks by rewriting them to callback forms.

- [ ] **Step 5: Convert list-style `select(...)` tests to callback-only `select(...)`**

Convert deferred list calls:

```ts
select([col("id"), col("name")])
```

to callback list calls:

```ts
select((row) => [row.id, row.name])
```

- [ ] **Step 6: Run test typecheck and record implementation failures**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: TypeScript fails only on source implementation that still accepts deferred refs, base join helpers that still accept mapped/merged third arguments, or imports that still reference removed helpers.

- [ ] **Step 7: Commit test conversion**

```bash
git add packages/teta/tests
git commit -m "test: convert edsl tests to callback column access"
```

---

### Task 4: Make Core Query Helpers Callback-Only

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query/extend.ts`
- Modify: `packages/teta/src/edsl/query/select.ts`
- Modify: `packages/teta/src/edsl/query/deferred_types.ts`

- [ ] **Step 1: Remove deferred imports from `builder.ts`**

In `packages/teta/src/edsl/query/builder.ts`, remove imports of:

```ts
resolveDeferredExpr
resolveDeferredOrderItem
resolveDeferredProjectionShape
DeferredExprDepsOf
```

Keep `ExprRef` and `createColumnRefs`.

- [ ] **Step 2: Delete deferred guard and value helper types from `builder.ts`**

Remove the local type blocks starting at `CurrentDepsOf<TExpr>` through `CurrentDeferredCollectionItem<TColumns, TExpr>`.

Also remove these deferred-specific types:

```ts
DeferredProjectionShapeInput
DefinedProjectionShape
DefinedJoinSelection
DeferredJoinSelectionValue
DeferredJoinSelectionResultForRecord
DeferredJoinSelection
DeferredExprInput
DeferredCurrentExprInput
DeferredJoinExprInput
DeferredExprValue
SortExprRefs
```

- [ ] **Step 3: Make projection inputs callback-only**

Change:

```ts
type SelectorOrSelection<TColumns extends QueryColumns, TSelection extends ProjectionShape> =
  ((cols: ColumnRefs<TColumns>) => TSelection) | TSelection;
```

to:

```ts
type Selector<TColumns extends QueryColumns, TSelection extends ProjectionShape> =
  (cols: ColumnRefs<TColumns>) => TSelection;
```

Update `buildMap` and `buildFold` to call the selector directly:

```ts
function buildMap<TColumns extends QueryColumns, TSelection extends ProjectionShape>(
  query: Query<TColumns>,
  selector: Selector<TColumns, TSelection>
): Query<ProjectionResult<TSelection>> {
  return deriveQuery(query, resolveMapQuery(query, selector(query.columns)));
}

function buildFold<TColumns extends QueryColumns, TSelection extends ProjectionShape>(
  query: Query<TColumns>,
  selector: Selector<TColumns, TSelection>
): Query<ProjectionResult<TSelection>> {
  return deriveQuery(query, resolveFoldQuery(query, selector(query.columns)));
}
```

- [ ] **Step 4: Make filter, sort, and unnest inputs callback-only**

Use these shapes:

```ts
type PredicateInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => ExprRef<boolean>;

type SortInput<TColumns extends QueryColumns> =
  (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[];

type UnnestSelectorInput<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
> = (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>;
```

Update `buildFilter`, `buildSort`, and `buildUnnest` so they never call deferred resolution:

```ts
const resolved = predicate(query.columns);
return deriveQuery(query, resolveFilterQuery(query, resolved.node));
```

```ts
const next = selector(query.columns);
const items = Array.isArray(next) ? next : [next];
```

```ts
const collection = selector(left.columns);
```

- [ ] **Step 5: Replace public overloads for `map`, `fold`, `filter`, `sort`, and `unnest`**

Keep only callback overloads:

```ts
export function map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;
```

```ts
export function fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;
```

```ts
export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns>;
```

```ts
export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;
```

```ts
export function unnest<
  TLeft extends QueryColumns,
  TCollection extends readonly unknown[] | unknown[] | null,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  selector: (cols: ColumnRefs<TLeft>) => ExprRef<TCollection>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options?: UnnestOptions<TOuter>
): QueryStep<TLeft, TLeft & UnnestGeneratedColumns<CollectionItem<TCollection>, TValueName, TOrdinalityName, TOuter>>;
```

- [ ] **Step 6: Make `extend` callback-only**

In `packages/teta/src/edsl/query/extend.ts`, remove the overload that accepts a projection object and remove imports from `deferred_types.ts`.

Keep:

```ts
export function extend<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, ProjectionResult<Sel>>>;
```

Implementation:

```ts
export function extend(...args: unknown[]): unknown {
  if (args[0] instanceof Query) {
    userError(
      "QUERY_HELPER_CURRIED_ONLY",
      "extend() is curried-only. Use pipe(query, extend(selector))."
    );
  }

  const [selector] = args;
  return (query: Query<QueryColumns>) => {
    if (typeof selector !== "function") {
      userError("QUERY_HELPER_INVALID", "extend() expects a row callback");
    }
    return map((cols: ColumnRefs<QueryColumns>) => ({
      ...currentColumns(cols, query.columnNames),
      ...(selector as (cols: ColumnRefs<QueryColumns>) => ProjectionShape)(cols),
    }))(query);
  };
}
```

- [ ] **Step 7: Handle `select(...)`**

Choose one:

- Keep callback-only `select((row) => [row.id])` and delete the overload for direct item arrays.
- Or remove `select` and `alias` from `packages/teta/src/edsl/query.ts` and `packages/teta/mod.ts`.

For the smallest phase-1 change, keep callback-only `select(...)` and remove the direct array overload. In `packages/teta/src/edsl/query/select.ts`, remove imports and code paths using `resolveDeferredExpr`; the callback returns concrete `ExprRef` values already.

- [ ] **Step 8: Run focused typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: failures should now be limited to comparison helpers, joins, stale tests/docs/examples, or public exports.

- [ ] **Step 9: Commit callback-only core helpers**

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/src/edsl/query/extend.ts packages/teta/src/edsl/query/select.ts packages/teta/src/edsl/query/deferred_types.ts
git commit -m "refactor: make core query helpers callback-only"
```

---

### Task 5: Split Fixed Join Helper Families

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/src/edsl/query/join.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`

- [ ] **Step 1: Add mapped and merged helper exports**

In `packages/teta/src/edsl/query/builder.ts`, keep base fixed joins with only `(right, on, options?)` and add separate helpers:

```ts
innerJoinMap(right, on, selector)
leftJoinMap(right, on, selector)
rightJoinMap(right, on, selector)
fullJoinMap(right, on, selector)

innerJoinMerge(right, on, merge)
leftJoinMerge(right, on, merge)
rightJoinMerge(right, on, merge)
fullJoinMerge(right, on, merge)
```

Mapped helpers should lower by calling `buildJoin(...)` with the selector as the merge/projection function. Merge helpers should lower by calling `buildJoin(...)` with the merge helper.

- [ ] **Step 2: Remove ambiguous base join overloads**

For `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin`, remove overloads where the third argument can be a merge function, merge shape, or deferred selection.

Keep this shape:

```ts
export function leftJoin<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnNoMerge<TLeft, TRight>,
  options?: FixedJoinOptions
): QueryStep<TLeft, JoinColumnsForType<TLeft, TRight, "left">>;
```

Keep `options?: FixedJoinOptions` on fixed base joins, and restrict `FixedJoinOptions` to `{ lateral?: boolean }`. Do not add shape-based positional parsing.

- [ ] **Step 3: Type mapped helpers**

Use the existing `JoinColumnMergerForType`, `JoinSelection`, and `JoinSelectionResult` types for `leftJoinMap`:

```ts
export function leftJoinMap<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  const TSelection extends JoinSelection,
>(
  right: Query<TRight> | ((outer: ColumnRefs<TLeft>) => Query<TRight>),
  on: JoinOnInput<TLeft, TRight>,
  selector: JoinColumnMergerForType<TLeft, TRight, "left", TSelection>
): QueryStep<TLeft, JoinSelectionResult<TSelection>>;
```

Repeat for inner/right/full with their fixed join type.

- [ ] **Step 4: Type merged helpers**

Use the same type shape as mapped helpers, but name the third parameter `merge`. The type can be identical because join merge helpers are functions from `(left, right)` to a selection.

```ts
export const leftJoinMerge = leftJoinMap;
```

Only use aliasing if exported typings remain explicit and `public_entrypoint.test.ts` accepts them. Otherwise define functions separately.

- [ ] **Step 5: Export new helpers**

Add exports in `packages/teta/src/edsl/query.ts` and `packages/teta/mod.ts` for:

```ts
innerJoinMap
leftJoinMap
rightJoinMap
fullJoinMap
innerJoinMerge
leftJoinMerge
rightJoinMerge
fullJoinMerge
```

Each exported const in `mod.ts` must have an explicit `typeof import(...)` type annotation.

- [ ] **Step 6: Update tests to use fixed helper families**

Replace:

```ts
leftJoin(orders, on, (left, right) => ({ ... }))
```

with:

```ts
leftJoinMap(orders, on, (left, right) => ({ ... }))
```

Replace:

```ts
leftJoin(orders, on, prefixOverlapLeft("left_"))
```

with:

```ts
leftJoinMerge(orders, on, prefixOverlapLeft("left_"))
```

- [ ] **Step 7: Run focused join tests**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts
bun run --cwd packages/teta typecheck
```

Expected: join runtime tests pass or fail only on expected SQL strings that need updating after helper renames; typecheck should no longer report join overload ambiguity.

- [ ] **Step 8: Commit fixed join helpers**

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/src/edsl/query/join.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts packages/teta/tests/typecheck.ts packages/teta/tests/query_functional.test.ts
git commit -m "refactor: split fixed join helper families"
```

---

### Task 6: Rewrite Comparison Helpers Without Deferred Operands

**Files:**
- Modify: `packages/teta/src/edsl/query/filter_comparison.ts`
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`

- [ ] **Step 1: Remove deferred imports and guards**

In `packages/teta/src/edsl/query/filter_comparison.ts`, remove:

```ts
resolveDeferredExpr
KnownDeferredCurrentColumnsGuard
CurrentDepsOf
ColumnValueForKey
SingleLiteralKey
```

Keep `ExprRef`, `ExprInput`, `ColumnRefs`, and comparison op imports.

- [ ] **Step 2: Define callback-or-literal operands**

Use:

```ts
type DirectOperand<TValue> = ExprInput<TValue>;
type CallableOperand<TColumns extends QueryColumns, TValue> =
  (cols: ColumnRefs<TColumns>) => ExprInput<TValue>;
type Operand<TColumns extends QueryColumns, TValue> =
  | DirectOperand<TValue>
  | CallableOperand<TColumns, TValue>;
```

Direct operands may still be literal values or already-built non-deferred expressions. They must not rely on `col(...)`.

- [ ] **Step 3: Simplify resolver**

Replace `resolveOperand(...)` with:

```ts
function resolveOperand<TColumns extends QueryColumns, T>(
  query: Query<TColumns>,
  operand: Operand<TColumns, T>
): ExprInput<T> {
  return isCallableOperand(operand)
    ? operand(query.columns)
    : operand;
}
```

- [ ] **Step 4: Preserve type checks for callback/literal operands**

Keep the existing comparable and same-value guard types where they do not depend on deferred deps. For callback-vs-literal forms, use the callback return value type and literal type to catch invalid comparisons:

```ts
filterEq((row) => row.name, "Ada")
filterEq((row) => row.id, 1)
// @ts-expect-error string column cannot compare to number literal
filterEq((row) => row.name, 1)
```

- [ ] **Step 5: Update tests**

Replace:

```ts
filterEq(col("name"), "Ada")
filterGt(col("credit_limit"), 0)
```

with:

```ts
filterEq((row) => row.name, "Ada")
filterGt((row) => row.credit_limit, 0)
```

Keep literal-vs-literal tests if they are intentional:

```ts
filterEq("status", "active")
```

- [ ] **Step 6: Run comparison-focused tests**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts
bun run --cwd packages/teta typecheck
```

Expected: comparison helper runtime tests pass and typecheck catches mismatched callback/literal comparisons.

- [ ] **Step 7: Commit comparison helper rewrite**

```bash
git add packages/teta/src/edsl/query/filter_comparison.ts packages/teta/tests/typecheck.ts packages/teta/tests/query_functional.test.ts
git commit -m "refactor: remove deferred operands from filter helpers"
```

---

### Task 7: Remove Deferred Runtime Types

**Files:**
- Modify: `packages/teta/src/edsl/core/expr/runtime.ts`
- Delete: `packages/teta/src/edsl/core/expr/deferred.ts`
- Delete: `packages/teta/src/edsl/query/deferred_types.ts` if no imports remain
- Modify any source files still found by `rg 'DeferredExpr|resolveDeferred|deferred_column|leftCol|rightCol|\bcol\(' packages/teta/src`

- [ ] **Step 1: Confirm no source imports deferred utilities**

Run:

```bash
rg -n 'DeferredExpr|resolveDeferred|deferred_column|leftCol|rightCol|\bcol\(' packages/teta/src
```

Expected before this task: only type/runtime definitions remain, not active query helper imports.

- [ ] **Step 2: Remove deferred phantom types from `runtime.ts`**

In `packages/teta/src/edsl/core/expr/runtime.ts`, change:

```ts
export type ExprInput<T> = ExprRef<T, any> | LiteralInput<T>;
export type ExprInputValue<TInput> = TInput extends ExprRef<infer TValue, any> ? TValue : TInput;
```

to:

```ts
export type ExprInput<T> = ExprRef<T> | LiteralInput<T>;
export type ExprInputValue<TInput> = TInput extends ExprRef<infer TValue> ? TValue : TInput;
```

Delete:

```ts
export type DeferredExprDeps
export type EmptyDeferredExprDeps
export type DeferredExprDepScope
export type DeferredExprDepsOf
type MergeDeferredExprDeps
type MergeDeferredExprDepsTuple
export type DeferredExprDepsForArgs
export interface ExprRef<T, TDeps extends DeferredExprDeps = EmptyDeferredExprDeps>
export type DeferredOrderItem<TDeps extends DeferredExprDeps = EmptyDeferredExprDeps>
```

Replace the class with:

```ts
export class ExprRef<T> {
  constructor(readonly node: ExprNode<T>) {}
}
```

Replace:

```ts
export type DeferredOrderItem<TDeps extends DeferredExprDeps = EmptyDeferredExprDeps> = OrderItem & {
  readonly __tetaDeferredExprDeps?: TDeps;
};
```

with no export.

- [ ] **Step 3: Remove deferred generic casts**

Update expression builders that return `ExprRef<T, DeferredExprDepsForArgs<...>>` to return `ExprRef<T>`.

Examples:

```ts
export function fn<T = unknown, const TArgs extends readonly ExprInput<unknown>[] = readonly ExprInput<unknown>[]>(
  name: string,
  ...args: TArgs
): ExprRef<T> {
  ...
}
```

```ts
export function aggregateExpr<T, TArg extends ExprInput<unknown>>(
  name: AggFunc,
  arg: TArg
): ExprRef<T> {
  ...
}
```

```ts
export function binaryExpr(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown> {
  return new ExprRef<unknown>({ kind: "binary", op, left, right });
}
```

- [ ] **Step 4: Delete deferred modules**

Delete:

```bash
packages/teta/src/edsl/core/expr/deferred.ts
packages/teta/src/edsl/query/deferred_types.ts
```

Only delete `deferred_types.ts` after `rg 'deferred_types' packages/teta/src packages/teta/tests` returns no source imports.

- [ ] **Step 5: Run source scan**

Run:

```bash
rg -n 'DeferredExpr|resolveDeferred|deferred_column|leftCol|rightCol|\bcol\(' packages/teta/src packages/teta/mod.ts
```

Expected: no matches.

- [ ] **Step 6: Run typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: pass.

- [ ] **Step 7: Commit deferred runtime removal**

```bash
git add packages/teta/src/edsl packages/teta/mod.ts
git add -u packages/teta/src/edsl/core/expr/deferred.ts packages/teta/src/edsl/query/deferred_types.ts
git commit -m "refactor: remove deferred expression runtime"
```

---

### Task 8: Update Docs, Examples, And Benchmarks

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `README.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TYPES.md`
- Modify: `doc/DEV_GUIDE.md`
- Modify files under `examples/` and `benchmarks/` found by scans below

- [ ] **Step 1: Find stale docs and examples**

Run:

```bash
rg -n '\bcol\(|leftCol|rightCol|DeferredExpr|select\(|alias\(' README.md packages/teta/README.md doc examples benchmarks
```

Expected: all matches are stale examples or wording to update.

- [ ] **Step 2: Rewrite README examples**

In `packages/teta/README.md`, replace deferred examples:

```ts
filterEq(col("active"), true)
sort(asc(col("email")))
```

with callback examples:

```ts
filterEq((user) => user.active, true)
sort((user) => asc(user.email))
```

Remove text saying to use `col("name")`, `leftCol("name")`, or `rightCol("name")`.

- [ ] **Step 3: Rewrite tutorial and cheatsheet examples**

Use these canonical replacements:

```ts
filter(and(eq(col("active"), true), gte(col("age"), 18)))
```

becomes:

```ts
filter((user) => and(eq(user.active, true), gte(user.age, 18)))
```

```ts
map({ id: col("id"), name: upper(col("name")) })
```

becomes:

```ts
map((user) => ({ id: user.id, name: upper(user.name) }))
```

```ts
leftJoin(orders, eq(leftCol("id"), rightCol("user_id")))
```

becomes:

```ts
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
```

- [ ] **Step 4: Update type guide terminology**

In `doc/TYPES.md`, rename public expression type guidance from `ExprRef<T>` only if the implementation changed the exported type name. For phase 1, keep `ExprRef<T>` documentation but remove all references to deferred dependency type parameters.

Use:

```ts
function isAdult(age: ExprRef<SqlInt>) {
  return gte(age, 18);
}
```

Do not document `ExprRef<T, TDeps>`.

- [ ] **Step 5: Update examples and benchmarks**

For every match under `examples/` and `benchmarks/`, apply the same callback conversions. Do not change expected SQL unless the query shape changed.

- [ ] **Step 6: Scan for stale references**

Run:

```bash
rg -n '\bcol\(|leftCol|rightCol|DeferredExpr|resolveDeferred|deferred column|deferred refs' README.md packages/teta/README.md doc examples benchmarks packages/teta
```

Expected: no matches except historical design docs under `docs/superpowers/` if included accidentally. Do not rewrite old committed design docs unless the user asks.

- [ ] **Step 7: Commit docs and example migration**

```bash
git add README.md packages/teta/README.md doc examples benchmarks
git commit -m "docs: document callback-only edsl surface"
```

---

### Task 9: Full Verification And Cleanup

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run package tests**

Run:

```bash
bun run --cwd packages/teta test
```

Expected: all `@teta/teta` tests pass.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 3: Run repository checks**

Run:

```bash
bun run check
```

Expected: metadata, sql, teta, and dev checks pass.

- [ ] **Step 4: Run stale API scan**

Run:

```bash
rg -n '\bcol\(|leftCol|rightCol|DeferredExpr|resolveDeferred|deferred_column' packages/teta packages/sql tests examples benchmarks README.md doc
```

Expected: no matches in active source, tests, docs, examples, or benchmarks. Historical docs under `docs/superpowers/` are acceptable if the scan includes them later.

- [ ] **Step 5: Inspect public exports**

Run:

```bash
rg -n 'export const (col|leftCol|rightCol)|DeferredExpr' packages/teta/mod.ts packages/teta/src/edsl
```

Expected: no matches.

- [ ] **Step 6: Commit cleanup fixes when needed**

If Steps 1-5 required fixes, commit them:

```bash
git add packages/teta packages/sql tests examples benchmarks README.md doc
git commit -m "chore: finish callback-only edsl migration"
```

If no fixes were needed, do not create an empty commit.

---

## Follow-Up Plan

After this plan passes, write a separate implementation plan for replacing public class-backed `Query` and `ExprRef` values with immutable tagged records. That follow-up should start from the callback-only surface established here and avoid changing user-facing helper semantics at the same time.
