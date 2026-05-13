# Top-Level Projection Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pick(...)`, `drop(...)`, and `rename(...)` top-level query steps only, and keep `caseWhen(...)` unchanged.

**Architecture:** Projection helpers remain in `packages/teta/src/edsl/query/projection_helpers.ts` and continue to delegate to `map(...)` internally. They stop accepting row column objects and instead return branded query-step functions that accept only `Query<TColumns>`. `drop(...)` computes the complement of the named columns and projects the remaining columns in current column order.

**Tech Stack:** TypeScript, Bun test runner, Teta query EDSL, public `mod.ts` entrypoint.

---

## File Structure

- Modify `packages/teta/src/edsl/query/projection_helpers.ts` to make helpers query-step-only and add `drop(...)`.
- Modify `packages/teta/src/edsl/query.ts` to export `drop`.
- Modify `packages/teta/mod.ts` to export typed `drop`.
- Modify `packages/teta/tests/deferred_proxy.test.ts` for runtime `pick`, `drop`, and `rename` query-step behavior and runtime unknown-column errors.
- Modify `packages/teta/tests/typecheck.ts` for type-level narrowing, `drop(...)`, and illegal `map(helper(...))` coverage.
- Modify `packages/teta/tests/query.test.ts` to keep top-level-only query examples.
- Modify `packages/teta/README.md`, `doc/cheatsheet.md`, `doc/TUTORIAL.md`, and `doc/TYPES.md` to remove row-selector projection helper examples.

### Task 1: Runtime Tests For Top-Level Projection Helpers

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`

- [ ] **Step 1: Update imports**

In `packages/teta/tests/deferred_proxy.test.ts`, add `drop` to the existing `../mod.ts` import list near `pick` and `rename`:

```ts
  drop,
  pick,
  pipe,
  rename,
```

- [ ] **Step 2: Replace row-selector helper tests with top-level-only tests**

Replace this test:

```ts
  test("exports pick as a selector helper", () => {
    expect(typeof pick("id")).toBe("function");
  });
```

with:

```ts
  test("exports projection helpers as query steps", () => {
    expect(typeof pick("id")).toBe("function");
    expect(typeof drop("id")).toBe("function");
    expect(typeof rename((key) => key)).toBe("function");
  });
```

Replace this test:

```ts
  test("supports pick for same-name projection", () => {
    const users = createUsersTable();
    const expected = pipe(users, map((user) => ({ id: user.id, name: user.name })));
    const actual = pipe(users, map(pick("id", "name")));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

with:

```ts
  test("supports drop as a direct query step", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      active: user.active,
    })));
    const actual = pipe(users, drop("age"));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

Delete the existing test named `supports rename as a row selector`.

- [ ] **Step 3: Add runtime unknown-column tests for `pick` and `drop`**

Add these tests after `supports drop as a direct query step`:

```ts
  test("reports missing picked columns", () => {
    const users = createUsersTable();

    expectTetaUserError(
      () => pipe(users, pick("missing")),
      "DEFERRED_COLUMN_UNKNOWN"
    );
  });

  test("reports missing dropped columns", () => {
    const users = createUsersTable();

    expectTetaUserError(
      () => pipe(users, drop("missing")),
      "DEFERRED_COLUMN_UNKNOWN"
    );
  });
```

- [ ] **Step 4: Run focused test to verify red state**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: FAIL because `drop` is not exported yet, and row-selector helper behavior still exists until implementation changes.

- [ ] **Step 5: Commit runtime test changes**

Run:

```bash
git add packages/teta/tests/deferred_proxy.test.ts
git commit -m "test: cover top-level projection helpers"
```

### Task 2: Type Tests For Query-Step-Only Helpers

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Update imports**

Add `drop` to the existing `../mod.ts` import list near `pick` and `rename`:

```ts
drop, pick, rename,
```

- [ ] **Step 2: Replace row-selector uses with top-level uses**

Replace:

```ts
const pickedUsers = pipe(users, map(pick("id", "name")));
```

with:

```ts
const pickedUsers = pipe(users, pick("id", "name"));
```

Replace:

```ts
// @ts-expect-error pick rejects unknown columns when applied to a typed query
const invalidPickedUsers = pipe(users, map(pick("missing")));
```

with:

```ts
// @ts-expect-error pick rejects unknown columns when applied to a typed query
const invalidPickedUsers = pipe(users, pick("missing"));
```

Replace:

```ts
const selectorPickedSelection = pipe(profiles, map(pick("id", "external_id")));
const selectorKeyMappedSelection = pipe(users, map(rename((key) => `prefix2_${key}`)));
```

with:

```ts
const droppedUsers = pipe(users, drop("name"));
const directDroppedProfiles = pipe(profiles, drop("avatar", "metadata"));
```

Replace:

```ts
const selectorKeyMappedUsage = pipe(selectorKeyMappedSelection, map((user) => ({
    id: user.prefix2_id,
    name: user.prefix2_name,
})));
```

with:

```ts
const droppedUsersUsage = pipe(droppedUsers, map((user) => ({
    id: user.id,
})));
```

- [ ] **Step 3: Replace type assertions and void references**

Replace:

```ts
type _SelectorPickedKeys = Expect<Equal<keyof typeof selectorPickedSelection.columns, "id" | "external_id">>;
type _SelectorPickedId = Expect<Equal<ExprType<typeof selectorPickedSelection.columns.id>, SqlUuid>>;
type _SelectorPickedExternalId = Expect<Equal<ExprType<typeof selectorPickedSelection.columns.external_id>, SqlBigInt>>;
```

with:

```ts
type _DroppedUsersKeys = Expect<Equal<keyof typeof droppedUsers.columns, "id">>;
type _DroppedUsersId = Expect<Equal<ExprType<typeof droppedUsers.columns.id>, SqlInt>>;
type _DirectDroppedProfilesKeys = Expect<Equal<keyof typeof directDroppedProfiles.columns, "id" | "external_id" | "credit_limit" | "nickname">>;
type _DirectDroppedProfilesId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.id>, SqlUuid>>;
type _DirectDroppedProfilesExternalId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.external_id>, SqlBigInt>>;
```

Replace:

```ts
type _SelectorKeyMappedId = Expect<Equal<ExprType<typeof selectorKeyMappedSelection.columns.prefix2_id>, SqlInt>>;
type _SelectorKeyMappedName = Expect<Equal<ExprType<typeof selectorKeyMappedSelection.columns.prefix2_name>, string>>;
```

with:

```ts
type _DroppedUsersUsageId = Expect<Equal<ExprType<typeof droppedUsersUsage.columns.id>, SqlInt>>;
```

Replace void references:

```ts
void selectorPickedSelection;
void selectorKeyMappedSelection;
void selectorKeyMappedUsage;
```

with:

```ts
void droppedUsers;
void directDroppedProfiles;
void droppedUsersUsage;
```

- [ ] **Step 4: Add negative top-level-only coverage**

Replace:

```ts
// @ts-expect-error rename should reject unknown selector renamed fields
pipe(selectorKeyMappedSelection, map((user) => ({ broken: user.prefix2_na })));
```

with:

```ts
// @ts-expect-error drop rejects unknown columns when applied to a typed query
pipe(users, drop("missing"));
// @ts-expect-error pick is a query step, not a map selector
pipe(users, map(pick("id")));
// @ts-expect-error drop is a query step, not a map selector
pipe(users, map(drop("name")));
// @ts-expect-error rename is a query step, not a map selector
pipe(users, map(rename((key) => `prefix2_${key}`)));
```

- [ ] **Step 5: Run typecheck to verify red state**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `drop` is not exported yet and the helpers still have row-selector signatures.

- [ ] **Step 6: Commit type test changes**

Run:

```bash
git add packages/teta/tests/typecheck.ts
git commit -m "test: enforce projection helper query steps"
```

### Task 3: Implement Query-Step-Only `pick`, `drop`, And `rename`

**Files:**
- Modify: `packages/teta/src/edsl/query/projection_helpers.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Replace helper types and implementation**

Replace the contents of `packages/teta/src/edsl/query/projection_helpers.ts` with:

```ts
import { userError } from "../errors.ts";
import { map, Query, type QueryStep } from "./builder.ts";
import type { ColumnRef, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

declare const PROJECTION_QUERY_STEP: unique symbol;

type ProjectionQueryStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
> = QueryStep<TInputColumns, TOutputColumns> & {
  readonly [PROJECTION_QUERY_STEP]: true;
};

type PickProjection<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: ColumnRef<TColumns[K], K>;
};

type PickResult<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: TColumns[K];
};

type DropResult<
  TColumns extends QueryColumns,
  TNames extends readonly [string, ...string[]],
> = {
  [K in Exclude<StringKeyOf<TColumns>, TNames[number]>]: TColumns[K];
};

type RenamePattern<TPattern extends string, TKey extends string> =
  TPattern extends `${infer TPrefix}_${string}`
    ? string extends TPrefix
      ? TPattern extends `${string}_${infer TSuffix}`
        ? `${TKey}_${TSuffix}`
        : string
      : `${TPrefix}_${TKey}`
    : TPattern extends `${string}_${infer TSuffix}`
      ? `${TKey}_${TSuffix}`
      : string;

type RenameProjection<TColumns extends QueryColumns, TPattern extends string> = {
  [K in StringKeyOf<TColumns> as RenamePattern<TPattern, K>]: ColumnRef<TColumns[K], K>;
};

type RenameResult<TColumns extends QueryColumns, TPattern extends string> = {
  [K in StringKeyOf<TColumns> as RenamePattern<TPattern, K>]: TColumns[K];
};

export function pick<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<PickResult<TColumns, TNames>> {
  const step = <TColumns extends Record<TNames[number], any>>(
    query: Query<TColumns>
  ): Query<PickResult<TColumns, TNames>> =>
    map((cols: ColumnRefs<TColumns>) => pickColumns(cols, names))(query);

  return brandProjectionStep(step);
}

export function drop<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): <TColumns extends Record<TNames[number], any>>(
  query: Query<TColumns>
) => Query<DropResult<TColumns, TNames>> {
  const step = <TColumns extends Record<TNames[number], any>>(
    query: Query<TColumns>
  ): Query<DropResult<TColumns, TNames>> => {
    const dropped = new Set<string>(names);
    const kept = query.columnNames.filter((name) => !dropped.has(name));
    for (const name of names) {
      if (!query.columnNames.includes(name)) {
        userError(
          "DEFERRED_COLUMN_UNKNOWN",
          `Unknown current row column '${name}'. Available columns: ${query.columnNames.join(", ")}`
        );
      }
    }
    return map((cols: ColumnRefs<TColumns>) =>
      pickColumns(cols, kept as readonly [StringKeyOf<DropResult<TColumns, TNames>>, ...StringKeyOf<DropResult<TColumns, TNames>>[]])
    )(query) as Query<DropResult<TColumns, TNames>>;
  };

  return brandProjectionStep(step);
}

export function rename<const TPattern extends string>(
  renameKey: (key: string) => TPattern
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
) => Query<RenameResult<TColumns, TPattern>> {
  const step = <TColumns extends QueryColumns>(
    query: Query<TColumns>
  ): Query<RenameResult<TColumns, TPattern>> =>
    map((cols: ColumnRefs<TColumns>) => renameColumns(cols, renameKey))(query);

  return brandProjectionStep(step);
}

function pickColumns<
  TColumns extends Record<TNames[number], any>,
  TNames extends readonly [string, ...string[]],
>(
  cols: ColumnRefs<TColumns>,
  names: TNames
): PickProjection<TColumns, TNames> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const name of names) {
    if (!(name in cols)) {
      userError(
        "DEFERRED_COLUMN_UNKNOWN",
        `Unknown current row column '${name}'. Available columns: ${Object.keys(cols).join(", ")}`
      );
    }
    result[name] = Reflect.get(cols, name) as ColumnRef<any, string>;
  }
  return result as PickProjection<TColumns, TNames>;
}

function renameColumns<TColumns extends QueryColumns, TPattern extends string>(
  cols: ColumnRefs<TColumns>,
  renameKey: (key: string) => TPattern
): RenameProjection<TColumns, TPattern> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const key of Object.keys(cols)) {
    result[renameKey(key)] = Reflect.get(cols, key) as ColumnRef<any, string>;
  }
  return result as RenameProjection<TColumns, TPattern>;
}

function brandProjectionStep<
  TInputColumns extends QueryColumns,
  TOutputColumns extends QueryColumns,
>(
  step: QueryStep<TInputColumns, TOutputColumns>
): ProjectionQueryStep<TInputColumns, TOutputColumns> {
  Object.defineProperty(step, PROJECTION_QUERY_STEP, {
    value: true,
    enumerable: false,
  });
  return step as ProjectionQueryStep<TInputColumns, TOutputColumns>;
}
```

- [ ] **Step 2: Export `drop` through query module**

In `packages/teta/src/edsl/query.ts`, change:

```ts
export { pick, rename } from "./query/projection_helpers.ts";
```

to:

```ts
export { drop, pick, rename } from "./query/projection_helpers.ts";
```

- [ ] **Step 3: Export `drop` from public entrypoint**

In `packages/teta/mod.ts`, add after `pick`:

```ts
/** Drops selected columns from the current query. */
export const drop: typeof import("./src/edsl/query.ts").drop = query.drop;
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts packages/teta/tests/query.test.ts
bun run --cwd packages/teta typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/query/projection_helpers.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts
git commit -m "feat: add top-level projection helpers"
```

### Task 4: Update Documentation Examples

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/TYPES.md`

- [ ] **Step 1: Replace row-selector examples**

Search for helper row-selector forms:

```bash
rg -n "map\\(pick|map\\(rename" packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
```

Replace examples like:

```ts
pipe(users, map(pick("id", "email")))
```

with:

```ts
pipe(users, pick("id", "email"))
```

Replace examples like:

```ts
pipe(users, map(pick("id", "name")), rename((key) => `user_${key}`))
```

with:

```ts
pipe(users, pick("id", "name"), rename((key) => `user_${key}`))
```

- [ ] **Step 2: Add `drop(...)` docs**

In `doc/cheatsheet.md` under projection helpers, add:

```ts
const publicUsers = pipe(users, drop("created_at"));
```

In `doc/TUTORIAL.md` projection helpers section, add `drop(...)` to the typical patterns list:

```md
- `drop(...)` for removing a small number of columns
```

- [ ] **Step 3: Ensure docs import `drop` where used**

For every docs snippet that uses `drop(...)`, ensure its import includes `drop`.

- [ ] **Step 4: Verify docs scan**

Run:

```bash
rg -n "map\\(pick|map\\(drop|map\\(rename|pickCols|mapCols" packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
```

Expected: no matches.

- [ ] **Step 5: Run full check**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 6: Commit documentation update**

Run:

```bash
git add packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
git commit -m "docs: show projection helpers as query steps"
```

### Task 5: Final Verification

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

- [ ] **Step 3: Run helper API scan**

Run:

```bash
rg -n "map\\(pick|map\\(drop|map\\(rename|pickCols|mapCols" packages/teta/src packages/teta/tests packages/teta/README.md doc examples benchmarks
```

Expected: no matches.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean worktree after all planned commits.
