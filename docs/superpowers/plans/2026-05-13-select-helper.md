# Select Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `select(...)` list-style projection and select-only `alias(...)` naming for function-first query projection.

**Architecture:** Keep `map(...)` object-shape projection unchanged. Add a focused `query/select.ts` public helper module and a list-projection resolver in the existing planner/mutation path so `select(...)` reuses normal map-stage SQL generation. Represent `alias(...)` as a small tagged wrapper consumed only by `select(...)`.

**Tech Stack:** TypeScript, Bun test runner, Teta query EDSL, public `packages/teta/mod.ts` entrypoint.

---

## File Structure

- Create `packages/teta/src/edsl/query/select.ts` for public `select(...)`, `alias(...)`, select item wrapper types, and deferred/current-scope type guards.
- Modify `packages/teta/src/edsl/query/planner.ts` to resolve list projection items into map-stage keys/items.
- Modify `packages/teta/src/edsl/query/mutations.ts` to add `resolveSelectQuery(...)`.
- Modify `packages/teta/src/edsl/query.ts` to export `select` and `alias`.
- Modify `packages/teta/mod.ts` to expose public `select` and `alias`.
- Modify `packages/teta/tests/deferred_proxy.test.ts` for runtime SQL and runtime error coverage.
- Modify `packages/teta/tests/typecheck.ts` for inference and negative type coverage.
- Modify `packages/teta/tests/errors.test.ts` and `packages/teta/tests/helpers/expected-errors.ts` for stable user-facing error messages.
- Modify docs: `packages/teta/README.md`, `doc/cheatsheet.md`, `doc/TUTORIAL.md`, `doc/TYPES.md`.

### Task 1: Add Runtime Tests For `select(...)`

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`

- [ ] **Step 1: Add imports**

Add `alias` and `select` to the import list from `../mod.ts`:

```ts
  alias,
  select,
```

- [ ] **Step 2: Add callback select test**

Add near the existing projection helper tests:

```ts
  test("supports select with callback column lists", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
    })));
    const actual = pipe(users, select((user) => [user.id, user.name]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 3: Add deferred select test**

Add after the callback select test:

```ts
  test("supports select with deferred column lists", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map({
      id: $.id,
      name: $.name,
    }));
    const actual = pipe(users, select([$.id, $.name]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 4: Add alias and generated name test**

Add after the deferred select test:

```ts
  test("supports select aliases and generated names", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      old_id: user.id,
      col_1: add(user.age, 1),
      name: user.name,
      col_2: add(user.age, 2),
    })));
    const actual = pipe(users, select((user) => [
      pipe(user.id, alias("old_id")),
      add(user.age, 1),
      user.name,
      add(user.age, 2),
    ]));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 5: Add duplicate-name runtime test**

Add after the alias test:

```ts
  test("rejects duplicate select output names", () => {
    const users = createUsersPipelineTable();

    expectTetaUserError(
      () => pipe(users, select((user) => [user.id, pipe(user.name, alias("id"))])),
      "SELECT_DUPLICATE_COLUMN"
    );
  });
```

- [ ] **Step 6: Run runtime tests to verify red state**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: FAIL because `select` and `alias` are not exported.

- [ ] **Step 7: Commit runtime tests**

Run:

```bash
git add packages/teta/tests/deferred_proxy.test.ts
git commit -m "test: cover select helper runtime"
```

### Task 2: Add Type Tests For `select(...)`

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add imports**

Add `alias` and `select` to the import list from `../mod.ts`:

```ts
alias,
select,
```

- [ ] **Step 2: Add positive type examples**

Add near the existing projection examples:

```ts
const selectedUsers = pipe(users, select((user) => [user.id, user.name]));
const deferredSelectedUsers = pipe(users, select([$.id, $.name]));
const aliasedSelectedUsers = pipe(users, select((user) => [
    pipe(user.id, alias("old_id")),
    pipe(upper(user.name), alias("name_upper")),
]));
const generatedSelectedUsers = pipe(users, select((user) => [
    user.id,
    add(user.id, 1),
    user.name,
    add(user.id, 2),
]));
const deferredGeneratedSelectedUsers = pipe(users, select([
    col("id"),
    add(col("id"), 1),
]));
```

- [ ] **Step 3: Add positive type assertions**

Add near projection type assertions:

```ts
type _SelectedUsersKeys = Expect<Equal<keyof typeof selectedUsers.columns, "id" | "name">>;
type _SelectedUsersId = Expect<Equal<ExprType<typeof selectedUsers.columns.id>, SqlInt>>;
type _SelectedUsersName = Expect<Equal<ExprType<typeof selectedUsers.columns.name>, string>>;
type _DeferredSelectedUsersKeys = Expect<Equal<keyof typeof deferredSelectedUsers.columns, "id" | "name">>;
type _DeferredSelectedUsersId = Expect<Equal<ExprType<typeof deferredSelectedUsers.columns.id>, SqlInt>>;
type _AliasedSelectedUsersKeys = Expect<Equal<keyof typeof aliasedSelectedUsers.columns, "old_id" | "name_upper">>;
type _AliasedSelectedUsersOldId = Expect<Equal<ExprType<typeof aliasedSelectedUsers.columns.old_id>, SqlInt>>;
type _AliasedSelectedUsersNameUpper = Expect<Equal<ExprType<typeof aliasedSelectedUsers.columns.name_upper>, string>>;
type _GeneratedSelectedUsersKeys = Expect<Equal<keyof typeof generatedSelectedUsers.columns, "id" | "col_1" | "name" | "col_2">>;
type _GeneratedSelectedUsersCol1 = Expect<Equal<ExprType<typeof generatedSelectedUsers.columns.col_1>, SqlInt>>;
type _GeneratedSelectedUsersCol2 = Expect<Equal<ExprType<typeof generatedSelectedUsers.columns.col_2>, SqlInt>>;
type _DeferredGeneratedSelectedUsersKeys = Expect<Equal<keyof typeof deferredGeneratedSelectedUsers.columns, "id" | "col_1">>;
type _DeferredGeneratedSelectedUsersCol1 = Expect<Equal<ExprType<typeof deferredGeneratedSelectedUsers.columns.col_1>, SqlInt>>;
```

- [ ] **Step 4: Add negative type tests**

Add near existing negative projection tests:

```ts
// @ts-expect-error select rejects unknown deferred current columns
pipe(users, select([col("missing")]));
// @ts-expect-error leftCol is invalid in current-row select context
pipe(users, select([leftCol("id")]));
// @ts-expect-error rightCol is invalid in current-row select context
pipe(users, select([rightCol("user_id")]));
// @ts-expect-error alias must wrap a select expression item through pipe
pipe(users, select((user) => [alias("bad")]));
```

- [ ] **Step 5: Add void references**

Add near existing void references:

```ts
void selectedUsers;
void deferredSelectedUsers;
void aliasedSelectedUsers;
void generatedSelectedUsers;
void deferredGeneratedSelectedUsers;
```

- [ ] **Step 6: Run typecheck to verify red state**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `select` and `alias` are not exported.

- [ ] **Step 7: Commit type tests**

Run:

```bash
git add packages/teta/tests/typecheck.ts
git commit -m "test: cover select helper types"
```

### Task 3: Implement List Projection Resolution

**Files:**
- Modify: `packages/teta/src/edsl/query/planner.ts`
- Modify: `packages/teta/src/edsl/query/mutations.ts`

- [ ] **Step 1: Export projected query resolver support**

In `packages/teta/src/edsl/query/planner.ts`, add exported select item types near `ResolvedProjection`:

```ts
export type SelectProjectionItem = {
  expr: ExprNode<any>;
  alias: string | null;
};

export type SelectProjection = readonly SelectProjectionItem[];
```

- [ ] **Step 2: Add list projection resolver**

In `packages/teta/src/edsl/query/planner.ts`, add this function after `resolveProjection(...)`:

```ts
export function resolveSelectProjection(selection: SelectProjection): ResolvedProjection {
  const keys: string[] = [];
  const items: Array<{ expr: ExprNode<any>; as: SqlIdentifier | null }> = [];
  let generatedCount = 0;

  for (const item of selection) {
    const expr = item.expr;
    if (containsGroup(expr)) {
      userError("GROUP_OUTSIDE_AGGREGATE", "group() is only valid inside fold()");
    }

    const key = item.alias ?? selectProjectionKey(expr, ++generatedCount);
    if (item.alias === null && expr.kind === "column") {
      generatedCount--;
    }
    if (keys.includes(key)) {
      userError("SELECT_DUPLICATE_COLUMN", `Duplicate selected column name: ${key}`);
    }

    keys.push(key);
    items.push({
      expr,
      as: shouldAlias(expr, key)
        ? normalizeIdentifier(key, "select alias")
        : null,
    });
  }

  return { keys, items };
}
```

- [ ] **Step 3: Add key helper**

In `packages/teta/src/edsl/query/planner.ts`, add this helper near `resolveProjectionExpr(...)`:

```ts
function selectProjectionKey(expr: ExprNode<any>, generatedIndex: number): string {
  if (expr.kind === "column") {
    return expr.name;
  }
  return `col_${generatedIndex}`;
}
```

- [ ] **Step 4: Add select mutation**

In `packages/teta/src/edsl/query/mutations.ts`, update imports from `./planner.ts`:

```ts
  resolveSelectProjection,
  type SelectProjection,
```

Add after `resolveMapQuery(...)`:

```ts
export function resolveSelectQuery<
  TSelectedColumns extends Record<string, any>,
>(
  query: QueryState<Record<string, any>>,
  selection: SelectProjection
): QueryDeriveInit<TSelectedColumns> {
  const { keys, items } = resolveSelectProjection(selection);
  return resolveProjectedQuery<TSelectedColumns>(query, {
    kind: "map",
    items,
    keys,
    groupBy: null,
    outputScopeId: freshScopeId(),
  });
}
```

- [ ] **Step 5: Run focused tests to verify still red for missing public API only**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `select` and `alias` are still not exported.

- [ ] **Step 6: Commit planner support**

Run:

```bash
git add packages/teta/src/edsl/query/planner.ts packages/teta/src/edsl/query/mutations.ts
git commit -m "feat: add select projection resolver"
```

### Task 4: Implement Public `select(...)` And `alias(...)`

**Files:**
- Create: `packages/teta/src/edsl/query/select.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Create select module**

Create `packages/teta/src/edsl/query/select.ts` with:

```ts
import { ExprRef, resolveDeferredExpr, toExprNode } from "../expr.ts";
import type {
  ColumnRefs,
  DeferredExprDepsOf,
  ExprInput,
  ExprInputValue,
} from "../expr.ts";
import { userError } from "../errors.ts";
import { Query } from "./builder.ts";
import type { QueryStep } from "./builder.ts";
import { resolveSelectQuery } from "./mutations.ts";
import { createQuery } from "./builder.ts";
import { resolveDerivedQueryInit } from "./state.ts";
import type { SelectProjection } from "./planner.ts";

type QueryColumns = Record<string, any>;
type SelectValue = ExprRef<unknown> | AliasedSelectValue<string, ExprRef<unknown>>;
type SelectList = readonly SelectValue[];
type StringKeyOf<T> = Extract<keyof T, string>;

const ALIASED_SELECT_VALUE: unique symbol = Symbol("teta.alias");

export type AliasedSelectValue<TName extends string, TExpr extends ExprRef<unknown>> = {
  readonly [ALIASED_SELECT_VALUE]: true;
  readonly name: TName;
  readonly expr: TExpr;
};

export function alias<const TName extends string>(
  name: TName
): <TExpr extends ExprRef<unknown>>(expr: TExpr) => AliasedSelectValue<TName, TExpr> {
  if (!name.trim()) {
    userError("SELECT_ALIAS_EMPTY", "alias name cannot be empty");
  }
  return (expr) => ({
    [ALIASED_SELECT_VALUE]: true,
    name,
    expr,
  });
}

type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LeftDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { left?: infer TLeft }
  ? TLeft
  : Record<never, never>;

type RightDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { right?: infer TRight }
  ? TRight
  : Record<never, never>;

type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

type CurrentDeferredGuard<TColumns extends QueryColumns, TExpr> =
  ([Exclude<LiteralDeferredKeys<CurrentDepsOf<TExpr>>, keyof TColumns>] extends [never]
    ? unknown
    : {
        __teta_unknown_deferred_current_columns__: Exclude<
          LiteralDeferredKeys<CurrentDepsOf<TExpr>>,
          keyof TColumns
        >;
      })
  & ([LiteralDeferredKeys<LeftDepsOf<TExpr>> | LiteralDeferredKeys<RightDepsOf<TExpr>>] extends [never]
    ? unknown
    : {
        __teta_invalid_deferred_current_scope_columns__:
          | LiteralDeferredKeys<LeftDepsOf<TExpr>>
          | LiteralDeferredKeys<RightDepsOf<TExpr>>;
      });

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

type CurrentDeferredListGuard<TColumns extends QueryColumns, TItems extends readonly unknown[]> =
  UnionToIntersection<{
    [K in keyof TItems]: CurrentDeferredGuard<TColumns, UnwrapAliased<TItems[K]>>;
  }[number]>;

type UnwrapAliased<TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? TExpr : TItem;

type SelectItemValue<TItem> =
  TItem extends AliasedSelectValue<string, infer TExpr> ? ExprInputValue<TExpr>
  : TItem extends ExprInput<unknown> ? ExprInputValue<TItem>
  : never;

type SelectOutputKey<TItem, TFallback extends string> =
  TItem extends AliasedSelectValue<infer TName, ExprRef<unknown>> ? TName
  : TItem extends ExprRef<unknown> ? TFallback
  : never;

type FallbackKeyForIndex<TItems extends readonly unknown[], TIndex extends keyof TItems> =
  TItems[TIndex] extends AliasedSelectValue<string, ExprRef<unknown>> ? never
  : TItems[TIndex] extends ExprRef<unknown> ? `col_${Extract<TIndex, `${number}`> extends never ? string : number}`
  : never;

type SelectResult<TItems extends readonly unknown[]> = {
  [K in keyof TItems as K extends `${number}`
    ? SelectOutputKey<TItems[K], FallbackKeyForIndex<TItems, K>>
    : never]: SelectItemValue<TItems[K]>;
};
```

- [ ] **Step 2: Add overloads and implementation**

Append to `select.ts`:

```ts
export function select<const TItems extends SelectList>(
  items: TItems
): <TColumns extends QueryColumns>(
  query: Query<TColumns> & CurrentDeferredListGuard<NoInfer<TColumns>, TItems>
) => Query<SelectResult<TItems>>;

export function select<TColumns extends QueryColumns, const TItems extends SelectList>(
  selector: (cols: ColumnRefs<TColumns>) => TItems
): QueryStep<TColumns, SelectResult<TItems>>;

export function select(selectorOrItems: unknown): unknown {
  return (query: Query<QueryColumns>) => {
    const rawItems = typeof selectorOrItems === "function"
      ? (selectorOrItems as (cols: ColumnRefs<QueryColumns>) => SelectList)(query.columns)
      : selectorOrItems;
    const items = normalizeSelectItems(rawItems);
    const projection = items.map((item) => {
      const expr = isAliasedSelectValue(item) ? item.expr : item;
      const resolved = resolveDeferredExpr(expr, {
        current: {
          label: "current row",
          columns: query.columns as ColumnRefs<Record<string, any>>,
          columnNames: query.columnNames,
        },
      });
      return {
        expr: toExprNode(resolved),
        alias: isAliasedSelectValue(item) ? item.name : null,
      };
    }) satisfies SelectProjection;

    return createQuery(resolveDerivedQueryInit(query, resolveSelectQuery(query, projection)));
  };
}

function normalizeSelectItems(value: unknown): SelectList {
  if (!Array.isArray(value)) {
    userError("SELECT_INVALID_SELECTION", "select() expects an array of expressions");
  }
  for (const item of value) {
    const expr = isAliasedSelectValue(item) ? item.expr : item;
    if (!(expr instanceof ExprRef)) {
      userError("SELECT_INVALID_SELECTION", "select() items must be expressions");
    }
  }
  return value as SelectList;
}

function isAliasedSelectValue(value: unknown): value is AliasedSelectValue<string, ExprRef<unknown>> {
  return value !== null
    && typeof value === "object"
    && (value as { readonly [ALIASED_SELECT_VALUE]?: unknown })[ALIASED_SELECT_VALUE] === true;
}
```

- [ ] **Step 3: Export through query module**

In `packages/teta/src/edsl/query.ts`, add:

```ts
export { alias, select } from "./query/select.ts";
```

- [ ] **Step 4: Export through public entrypoint**

In `packages/teta/mod.ts`, add near `map` / `extend`:

```ts
/** Projects a query from a list of expressions, preserving column names where possible. */
export const select: typeof import("./src/edsl/query.ts").select = query.select;

/** Names an expression inside `select(...)`. */
export const alias: typeof import("./src/edsl/query.ts").alias = query.alias;
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS, or fail only for type-level generated keys that need refinement in the next task.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/query/select.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts
git commit -m "feat: add select query helper"
```

### Task 5: Refine `select(...)` Type Inference

**Files:**
- Modify: `packages/teta/src/edsl/query/select.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Inspect typecheck failures**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected before this task: generated-key assertions may fail because TypeScript cannot derive direct column names from runtime `ColumnRef` instances.

- [ ] **Step 2: Add explicit runtime-compatible type wrappers if needed**

If direct column names cannot be inferred from callback `ColumnRef` values, update `SelectResult<TItems>` in `select.ts` so:

```ts
select((u) => [u.id, u.name])
```

infers `col_1 | col_2` only if TypeScript cannot preserve names. If this happens, update type tests to assert the best reliable compile-time behavior while keeping runtime tests strict for `{ id, name }`.

If the type system can preserve names through `ColumnRef<T, Name>`, import `ColumnRef` and use:

```ts
type SelectOutputKey<TItem, TFallback extends string> =
  TItem extends AliasedSelectValue<infer TName, ExprRef<unknown>> ? TName
  : TItem extends ColumnRef<unknown, infer TName> ? TName
  : TItem extends ExprRef<unknown> ? TFallback
  : never;
```

- [ ] **Step 3: Ensure generated keys count computed expressions only**

If type-level `col_N` cannot count only computed unnamed expressions in mixed lists, document the limitation in a short comment and ensure runtime behavior is correct. Prefer exact type inference if practical, but do not overbuild a fragile tuple counter.

- [ ] **Step 4: Run verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit type refinement**

Run:

```bash
git add packages/teta/src/edsl/query/select.ts packages/teta/tests/typecheck.ts
git commit -m "fix: refine select helper types"
```

### Task 6: Add Runtime Error Coverage

**Files:**
- Modify: `packages/teta/tests/errors.test.ts`
- Modify: `packages/teta/tests/helpers/expected-errors.ts`
- Modify: `packages/teta/tests/deferred_proxy.test.ts`

- [ ] **Step 1: Add expected error helpers**

In `packages/teta/tests/helpers/expected-errors.ts`, add:

```ts
export const SELECT_DUPLICATE_COLUMN_ERROR =
  "Duplicate selected column name: id";

export const SELECT_ALIAS_EMPTY_ERROR =
  "alias name cannot be empty";

export const SELECT_INVALID_SELECTION_ERROR =
  "select() items must be expressions";
```

- [ ] **Step 2: Import expected errors**

In `packages/teta/tests/errors.test.ts`, add the constants above to the import from `./helpers/expected-errors.ts`.

In the import from `../mod.ts`, add:

```ts
alias,
select,
```

- [ ] **Step 3: Add user-facing error tests**

Add near projection/runtime error tests:

```ts
    test("rejects invalid select helper usage", () => {
        const users = createUsersTable();

        expect(() => pipe(users, select((user) => [
            user.id,
            pipe(user.name, alias("id")),
        ]))).toThrow(SELECT_DUPLICATE_COLUMN_ERROR);

        expect(() => alias("")).toThrow(SELECT_ALIAS_EMPTY_ERROR);

        expect(() => pipe(users, select((user) => [
            alias("bad") as never,
        ]))).toThrow(SELECT_INVALID_SELECTION_ERROR);
    });
```

- [ ] **Step 4: Add deferred scope runtime test**

In `packages/teta/tests/deferred_proxy.test.ts`, add near deferred error tests:

```ts
  test("reports join-side deferred refs outside select", () => {
    const users = createUsersPipelineTable();

    expectTetaUserError(
      () => pipe(users, select([leftCol("id")])),
      "DEFERRED_COLUMN_SCOPE"
    );
  });
```

- [ ] **Step 5: Run focused runtime tests**

Run:

```bash
bun test packages/teta/tests/errors.test.ts
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit error coverage**

Run:

```bash
git add packages/teta/tests/errors.test.ts packages/teta/tests/helpers/expected-errors.ts packages/teta/tests/deferred_proxy.test.ts
git commit -m "test: cover select helper errors"
```

### Task 7: Update Documentation

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/TYPES.md`

- [ ] **Step 1: Update README**

Add a short example near projection examples:

```md
Use `select(...)` for list-style projections when column names can be kept from plain column refs:

```ts
const publicUsers = pipe(
  users,
  select((user) => [
    user.id,
    user.name,
    pipe(upper(user.email), alias("email_upper")),
  ])
);
```
```

- [ ] **Step 2: Update cheatsheet**

Add `select` and `alias` to the public API import block if present.

Add under projection helpers:

```md
Use `select(...)` for list-style projections:

```ts
pipe(users, select((user) => [
  user.id,
  user.name,
  pipe(upper(user.name), alias("name_upper")),
]))
```

Plain column refs keep their names. Unaliased computed expressions get generated names like `col_1`.
```

- [ ] **Step 3: Update tutorial**

Add a short paragraph in the projection section:

```md
`select(...)` projects from an expression list. Plain column refs keep their source names, and `alias(...)` names computed expressions:

```ts
const q = pipe(users, select((user) => [
  user.id,
  pipe(upper(user.name), alias("name_upper")),
]));
```
```

- [ ] **Step 4: Update TYPES**

Add a bullet near query-step type discussion:

```md
- `select(...)` returns a projection query step from an expression list. Plain column refs keep their names, aliased expressions use `alias("name")`, and unnamed computed expressions get generated names such as `col_1`.
```

- [ ] **Step 5: Run docs check**

Run:

```bash
rg -n "select\\(|alias\\(" packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
bun run check
```

Expected: PASS.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
git commit -m "docs: show select helper"
```

### Task 8: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full test suite**

Run:

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full check**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 4: Inspect public exports**

Run:

```bash
rg -n "select|alias" packages/teta/mod.ts packages/teta/src/edsl/query.ts packages/teta/src/edsl/query/select.ts
```

Expected: `select` and `alias` are exported from `packages/teta/src/edsl/query.ts` and `packages/teta/mod.ts`.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated changes remain, specifically `examples/bun/dialect_report.ts`, unless the user has changed the workspace during execution.
