# Curried-Only Query Helper API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove data-first runtime and type support for Teta's row-transforming query helpers while keeping the curried query-step API.

**Architecture:** Public query helpers become thin curried factories that return `QueryStep` closures and call existing internal data-first builders only after `pipe(...)` supplies the query. Join parsing remains curried, with a small runtime guard to reject removed data-first join forms without rejecting valid curried joins whose right side is a `Query`.

**Tech Stack:** TypeScript, Bun test runner, Remeda `pipe`, existing Teta EDSL query builder.

---

## File Structure

- Modify `packages/teta/src/edsl/query/builder.ts`
  - Remove data-first overloads for `map`, `filter`, `fold`, `sort`, `take`, `join`, `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin`.
  - Replace public `purry(...)` dispatch for the selected helpers with curried-only closure factories.
  - Keep internal `buildMap`, `buildFilter`, `buildFold`, `buildSort`, `buildTake`, and `buildJoin` data-first functions private.
  - Preserve `union`, `unionAll`, `loop`, and `unnest` behavior.
- Modify `packages/teta/tests/helpers/expected-errors.ts`
  - Add stable error text for curried-only runtime errors.
- Modify `packages/teta/tests/errors.test.ts`
  - Add red runtime tests for removed data-first calls.
  - Migrate existing tests in this file to curried query helpers.
- Modify `packages/teta/tests/typecheck.ts`
  - Migrate positive data-first calls to curried calls.
  - Add negative `@ts-expect-error` cases for removed data-first calls.
- Modify runtime tests under `packages/teta/tests/**/*.ts`
  - Migrate data-first uses of selected helpers to `pipe(query, helper(...))` or intermediate variables.
- Modify examples and benchmarks:
  - `examples/**/*.ts`
  - `benchmarks/render_shared.ts`
- Modify docs:
  - `packages/teta/README.md`
  - `doc/cheatsheet.md`
- Do not add a `limit(...)` helper; `take(...)` remains the limit-stage API.

## Baseline

Before implementation, the isolated worktree baseline passed:

```bash
bun run check
```

Expected baseline output includes:

```text
202 pass
0 fail
16 pass
0 fail
```

## Task 1: Add Failing Runtime And Type Tests

**Files:**
- Modify: `packages/teta/tests/helpers/expected-errors.ts`
- Modify: `packages/teta/tests/errors.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add expected curried-only error text**

In `packages/teta/tests/helpers/expected-errors.ts`, add these exports after `LEGACY_JOIN_MERGE_OPTION_ERROR`:

```ts
export const MAP_CURRIED_ONLY_ERROR =
  "map() is curried-only. Use pipe(query, map(selector)).";

export const FILTER_CURRIED_ONLY_ERROR =
  "filter() is curried-only. Use pipe(query, filter(predicate)).";

export const FOLD_CURRIED_ONLY_ERROR =
  "fold() is curried-only. Use pipe(query, fold(selector)).";

export const SORT_CURRIED_ONLY_ERROR =
  "sort() is curried-only. Use pipe(query, sort(selector)).";

export const TAKE_CURRIED_ONLY_ERROR =
  "take() is curried-only. Use pipe(query, take(count)).";

export const JOIN_CURRIED_ONLY_ERROR =
  "join() is curried-only. Use pipe(query, join(right, on, merge?, options?)).";

export const INNER_JOIN_CURRIED_ONLY_ERROR =
  "innerJoin() is curried-only. Use pipe(query, innerJoin(right, on, merge?, options?)).";

export const LEFT_JOIN_CURRIED_ONLY_ERROR =
  "leftJoin() is curried-only. Use pipe(query, leftJoin(right, on, merge?, options?)).";

export const RIGHT_JOIN_CURRIED_ONLY_ERROR =
  "rightJoin() is curried-only. Use pipe(query, rightJoin(right, on, merge?, options?)).";

export const FULL_JOIN_CURRIED_ONLY_ERROR =
  "fullJoin() is curried-only. Use pipe(query, fullJoin(right, on, merge?, options?)).";
```

- [ ] **Step 2: Add runtime rejection tests**

In `packages/teta/tests/errors.test.ts`, import `pipe`, `filter`, `sort`, `take`, `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin` if they are not already imported. Extend the expected-error import with the constants added in Step 1.

Add this helper inside the `describe("error paths", () => { ... })` block before the new tests:

```ts
function expectUserError(fn: () => unknown, code: string, message: string): void {
  try {
    fn();
    throw new Error("Expected TetaUserError");
  } catch (error) {
    expect(error).toBeInstanceOf(TetaUserError);
    expect((error as TetaUserError).kind).toBe("user");
    expect((error as TetaUserError).code).toBe(code);
    expect((error as TetaUserError).message).toBe(message);
  }
}
```

Add this test near the existing join/error tests:

```ts
test("rejects removed data-first query helper calls at runtime", () => {
  const users = createUsersTable();
  const orders = createOrdersTable();

  expectUserError(
    () => (map as any)(users, (user: typeof users.columns) => ({ id: user.id })),
    "QUERY_HELPER_CURRIED_ONLY",
    MAP_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (filter as any)(users, (user: typeof users.columns) => eq(user.id, 1)),
    "QUERY_HELPER_CURRIED_ONLY",
    FILTER_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (fold as any)(orders, (order: typeof orders.columns) => ({
      user_id: group(order.user_id),
      total: count(order.order_id),
    })),
    "QUERY_HELPER_CURRIED_ONLY",
    FOLD_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (sort as any)(users, (user: typeof users.columns) => user.id),
    "QUERY_HELPER_CURRIED_ONLY",
    SORT_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (take as any)(users, 10),
    "QUERY_HELPER_CURRIED_ONLY",
    TAKE_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (join as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
    "QUERY_HELPER_CURRIED_ONLY",
    JOIN_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (innerJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
    "QUERY_HELPER_CURRIED_ONLY",
    INNER_JOIN_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (leftJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
    "QUERY_HELPER_CURRIED_ONLY",
    LEFT_JOIN_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (rightJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
    "QUERY_HELPER_CURRIED_ONLY",
    RIGHT_JOIN_CURRIED_ONLY_ERROR
  );
  expectUserError(
    () => (fullJoin as any)(users, orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)),
    "QUERY_HELPER_CURRIED_ONLY",
    FULL_JOIN_CURRIED_ONLY_ERROR
  );
});
```

- [ ] **Step 3: Add a lateral data-first runtime rejection test**

Add this test after the previous one:

```ts
test("rejects removed data-first lateral join callbacks at runtime", () => {
  const users = createUsersTable();
  const orders = createOrdersTable();

  expectUserError(
    () => (join as any)(
      users,
      (user: typeof users.columns) =>
        pipe(
          orders,
          filter((order: typeof orders.columns) => eq(order.user_id, user.id))
        ),
      (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)
    ),
    "QUERY_HELPER_CURRIED_ONLY",
    JOIN_CURRIED_ONLY_ERROR
  );
});
```

- [ ] **Step 4: Add type-level rejection tests**

At the bottom of `packages/teta/tests/typecheck.ts`, add these negative cases:

```ts
// @ts-expect-error map is curried-only
map(users, (user) => ({ id: user.id }));
// @ts-expect-error filter is curried-only
filter(users, (user) => eq(user.id, 1));
// @ts-expect-error fold is curried-only
fold(orders, (order) => ({ user_id: group(order.user_id) }));
// @ts-expect-error sort is curried-only
sort(users, (user) => asc(user.id));
// @ts-expect-error take is curried-only
take(users, 10);
// @ts-expect-error join is curried-only
join(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error innerJoin is curried-only
innerJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error leftJoin is curried-only
leftJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error rightJoin is curried-only
rightJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error fullJoin is curried-only
fullJoin(users, orders, (user, order) => eq(user.id, order.user_id));
```

- [ ] **Step 5: Run tests to verify RED**

Run:

```bash
bun test packages/teta/tests/errors.test.ts
```

Expected: FAIL because data-first calls still work.

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: FAIL with unused `@ts-expect-error` directives for the new curried-only negative cases.

- [ ] **Step 6: Record RED status and continue to implementation**

Do not commit the failing tests by themselves. Leave the red test changes in the worktree for Task 2 so the next commit contains both the failing tests and the implementation that makes them pass.

## Task 2: Remove Data-First Helper Runtime Paths And Overloads

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Test: `packages/teta/tests/errors.test.ts`
- Test: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add curried-only error helpers**

In `packages/teta/src/edsl/query/builder.ts`, add these helpers near `assertNoLegacyJoinMergeOption`:

```ts
function curriedOnlyError(helper: string, usage: string): never {
  userError(
    "QUERY_HELPER_CURRIED_ONLY",
    `${helper}() is curried-only. Use pipe(query, ${usage}).`
  );
}

function assertNotDataFirstQueryHelper(helper: string, usage: string, args: unknown[]): void {
  if (args[0] instanceof Query) {
    curriedOnlyError(helper, usage);
  }
}
```

- [ ] **Step 2: Replace `map` and `fold` public implementations**

Replace the public `map` overload block with curried-only overloads and implementation:

```ts
export function map<const Sel extends Record<string, unknown>>(
  selection: NonCallableSelection<Sel> & DeferredProjectionShapeInput<Sel>
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<ProjectionResult<DefinedProjectionShape<Sel>>>;

export function map<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function map(...args: unknown[]): unknown {
  assertNotDataFirstQueryHelper("map", "map(selector)", args);
  const [selector] = args;
  return (query: Query<QueryColumns>) =>
    _map(
      query,
      selector as SelectorOrSelection<QueryColumns, ProjectionShape>
    );
}
```

Replace the public `fold` overload block with:

```ts
export function fold<const Sel extends Record<string, unknown>>(
  selection: NonCallableSelection<Sel> & DeferredProjectionShapeInput<Sel>
): <TColumns extends QueryColumns>(query: Query<TColumns>) => Query<ProjectionResult<DefinedProjectionShape<Sel>>>;

export function fold<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): QueryStep<TColumns, ProjectionResult<Sel>>;

export function fold(...args: unknown[]): unknown {
  assertNotDataFirstQueryHelper("fold", "fold(selector)", args);
  const [selector] = args;
  return (query: Query<QueryColumns>) =>
    _fold(
      query,
      selector as SelectorOrSelection<QueryColumns, ProjectionShape>
    );
}
```

Keep the existing private `_map` and `_fold` functions.

- [ ] **Step 3: Replace `filter`, `sort`, and `take` public implementations**

Replace the public `filter` overload block with:

```ts
export function filter<TColumns extends QueryColumns>(
  predicate: ExprRef<boolean>
): QueryStep<TColumns, TColumns>;

export function filter<TColumns extends QueryColumns>(
  predicate: (cols: ColumnRefs<TColumns>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns>;

export function filter(...args: unknown[]): unknown {
  assertNotDataFirstQueryHelper("filter", "filter(predicate)", args);
  const [predicate] = args;
  return (query: Query<QueryColumns>) =>
    _filter(query, predicate as PredicateInput<QueryColumns>);
}
```

Replace the public `sort` overload block with:

```ts
export function sort<TColumns extends QueryColumns>(
  selector: OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort<TColumns extends QueryColumns>(
  selector: (cols: ColumnRefs<TColumns>) => OrderItem | OrderItem[]
): QueryStep<TColumns, TColumns>;

export function sort(...args: unknown[]): unknown {
  assertNotDataFirstQueryHelper("sort", "sort(selector)", args);
  const [selector] = args;
  return (query: Query<QueryColumns>) =>
    _sort(query, selector as SortInput<QueryColumns>);
}
```

Replace the public `take` overload block with:

```ts
export function take<TColumns extends QueryColumns>(count: number): QueryStep<TColumns, TColumns>;

export function take(...args: unknown[]): unknown {
  assertNotDataFirstQueryHelper("take", "take(count)", args);
  const [count] = args;
  return (query: Query<QueryColumns>) => _take(query, count as number);
}
```

Keep the existing private `_filter`, `_sort`, and `_take` functions.

- [ ] **Step 4: Replace `join` public implementation**

Remove the three data-first `join(...)` overloads and keep the three curried overloads.

Replace the implementation with:

```ts
export function join(...args: unknown[]): unknown {
  const parsed = parseCurriedJoinInvocation(args, "join", "join(right, on, merge?, options?)");

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, "inner", JoinSelection> | undefined,
      parsed.options as JoinOptions<JoinTypeInput | undefined> | undefined
    );
}
```

- [ ] **Step 5: Replace fixed join public overloads and implementation**

For `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin`, remove the three data-first overloads for each helper. Keep the three curried overloads for each helper.

Replace `buildFixedJoinOverload` with:

```ts
function buildFixedJoinOverload(
  args: unknown[],
  type: "inner" | "left" | "right" | "full"
): unknown {
  const parsed = parseCurriedJoinInvocation(
    args,
    `${type}Join`,
    `${type}Join(right, on, merge?, options?)`
  );

  return (left: Query<QueryColumns>) =>
    _join(
      left,
      parsed.right as Query<QueryColumns> | ((outer: ColumnRefs<QueryColumns>) => Query<QueryColumns>),
      parsed.on as JoinOnInput<QueryColumns, QueryColumns>,
      parsed.merge as JoinMergeInput<QueryColumns, QueryColumns, typeof type, JoinSelection> | undefined,
      { ...(parsed.options as FixedJoinOptions | undefined), type }
    );
}
```

After adding this code, adjust the helper name for `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin` so error messages exactly match the expected constants. Use this helper instead of string interpolation if needed:

```ts
function fixedJoinHelperName(type: "inner" | "left" | "right" | "full"): string {
  switch (type) {
    case "inner":
      return "innerJoin";
    case "left":
      return "leftJoin";
    case "right":
      return "rightJoin";
    case "full":
      return "fullJoin";
  }
}
```

Then call:

```ts
const helper = fixedJoinHelperName(type);
const parsed = parseCurriedJoinInvocation(args, helper, `${helper}(right, on, merge?, options?)`);
```

- [ ] **Step 6: Replace join parsing with curried parsing plus data-first rejection**

Replace `parseJoinInvocation` with:

```ts
type ParsedCurriedJoinInvocation = {
  right: unknown;
  on: unknown;
  merge: unknown;
  options: unknown;
};

const DATA_FIRST_JOIN_INVOCATION = Symbol("DATA_FIRST_JOIN_INVOCATION");

function parseCurriedJoinInvocation(
  args: unknown[],
  helper: string,
  usage: string
): ParsedCurriedJoinInvocation {
  assertNotDataFirstJoinInvocation(args, helper, usage);
  const [right, on, maybeMerge, maybeOptions] = args;
  const { merge, options } = parseJoinMergeAndOptions(maybeMerge, maybeOptions);
  return { right, on, merge, options };
}

function assertNotDataFirstJoinInvocation(
  args: unknown[],
  helper: string,
  usage: string
): void {
  const first = args[0];
  const second = args[1];
  if (!(first instanceof Query)) return;

  if (second instanceof Query) {
    curriedOnlyError(helper, usage);
  }

  if (typeof second === "function" && typeof args[2] === "function") {
    try {
      const probed = (second as (outer: ColumnRefs<QueryColumns>) => unknown)(
        qualifyOuterColumns(first.columns)
      );
      if (probed instanceof Query) {
        throw DATA_FIRST_JOIN_INVOCATION;
      }
    } catch (error) {
      if (error === DATA_FIRST_JOIN_INVOCATION) {
        curriedOnlyError(helper, usage);
      }
    }
  }
}
```

Keep `parseJoinMergeAndOptions`, `isJoinMergeShape`, and `isJoinOptionsShape`.

- [ ] **Step 7: Run focused RED-to-GREEN checks**

Run:

```bash
bun test packages/teta/tests/errors.test.ts
```

Expected after implementation: tests added in Task 1 pass, but unrelated tests may still fail until data-first call sites in the same file are migrated.

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected after implementation: new curried-only `@ts-expect-error` cases are no longer unused. Existing positive data-first uses still fail until Task 3 migration.

- [ ] **Step 8: Commit builder implementation and contract tests**

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/tests/helpers/expected-errors.ts packages/teta/tests/errors.test.ts packages/teta/tests/typecheck.ts
git commit -m "feat: make core query helpers curried-only"
```

## Task 3: Migrate Type Coverage And Core Runtime Tests

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`
- Modify: `packages/teta/tests/errors.test.ts`
- Modify: `packages/teta/tests/helpers/fixtures.ts`
- Modify: `packages/teta/tests/aggregate.test.ts`
- Modify: `packages/teta/tests/query.test.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`
- Modify: `packages/teta/tests/deferred_proxy.test.ts`
- Modify: remaining `packages/teta/tests/**/*.ts` files with data-first selected-helper calls

- [ ] **Step 1: Migrate positive typecheck setup to curried calls**

In `packages/teta/tests/typecheck.ts`, convert positive selected-helper calls to `pipe(...)`. The first block should follow this shape:

```ts
const leftJoined = pipe(users, leftJoin(orders, (user, order) => eq(user.id, order.user_id)));
const rightJoined = pipe(users, rightJoin(orders, (user, order) => eq(user.id, order.user_id)));
const fullJoined = pipe(users, fullJoin(orders, (user, order) => eq(user.id, order.user_id)));
const leftViaJoin = pipe(users, join(orders, (user, order) => eq(user.id, order.user_id), { type: "left" }));
const renamedJoin = pipe(users, innerJoin(orders, (user, order) => eq(user.id, order.user_id), (user, order) => ({
  user_id: user.id,
  order_total: order.total,
})));
```

Use the same pattern for join helpers through `mappedJoin`:

```ts
const usingJoin = pipe(users, join(profileRows, usingCols("id"), dropOverlapLeft()));
const mappedJoin = pipe(users, leftJoin(table("profiles_mapped", {
  id: t.int(),
  user_id: t.int(),
  bio: t.string(),
}), onEq({ id: "user_id" }), prefixOverlapLeft("left_")));
```

Convert map/filter/fold positives:

```ts
const filteredUsers = pipe(users, filter((user: typeof users.columns) => gt(user.id, 0)));
const projectedUsers = pipe(filteredUsers, map((user: typeof filteredUsers.columns) => ({
  id: user.id,
  name: upper(user.name),
})));
const projectedUsersDeferred = pipe(filteredUsers, map({
  id: $.id,
  name: upper($.name),
}));
const pickedUsers = pipe(users, map(pickCols("id", "name")));
```

Keep intentional negative cases data-first only when they are testing curried-only rejection. Convert old semantic negative cases to curried form. For example:

```ts
// @ts-expect-error filter predicates must return boolean expressions
pipe(users, filter((user) => user.name));
// @ts-expect-error join predicates must return boolean expressions
pipe(users, join(orders, (user, order) => order.total));
// @ts-expect-error default joins with overlapping output names require an explicit merge strategy
pipe(users, join(profileRows, (user, profile) => eq(user.id, profile.id)));
```

- [ ] **Step 2: Migrate `errors.test.ts` existing semantic tests**

Convert existing semantic tests to curried form while keeping the new data-first rejection tests from Task 1. Examples:

```ts
expect(() => pipe(users, map((user) => ({
  bad: group(user.id),
})))).toThrow(GROUP_OUTSIDE_AGGREGATE_ERROR);
```

```ts
expect(() => pipe(users, fold((user) => ({
  bad: count(group(user.id)),
})))).toThrow(GROUP_INSIDE_AGGREGATE_FUNCTION_ERROR);
```

```ts
expect(() => pipe(
  users,
  join(orders, (user, order) => eq(user.id, order.user_id), { type: "cross" as never })
)).toThrow(UNSUPPORTED_CROSS_JOIN_ERROR);
```

```ts
expect(() => pipe(
  users,
  join(orders, (user, order) => eq(user.id, order.user_id), {
    merge: (user: typeof users.columns, order: typeof orders.columns) => ({
      id: user.id,
      total: order.total,
    }),
  } as never)
)).toThrow(LEGACY_JOIN_MERGE_OPTION_ERROR);
```

- [ ] **Step 3: Migrate core test helpers**

In `packages/teta/tests/helpers/fixtures.ts`, convert data-first helper chains to `pipe`. The pipeline helper should look like:

```ts
return pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map((user) => ({
    id: user.id,
    name: coalesce(replace(user.name, " ", "_"), "unknown"),
    age: user.age,
  })),
  sort((user) => [asc(user.name), desc(user.id)]),
  take(20)
);
```

Convert recursive helper setup to the same style:

```ts
return loop(
  pipe(
    employees,
    filter((employee) => isNull(employee.manager_id)),
    map((employee) => ({
      id: employee.id,
      name: employee.name,
      manager_id: employee.manager_id,
    }))
  ),
  (self) => pipe(
    employees,
    join(self, (employee, current) => eq(employee.manager_id, current.id), (employee) => ({
      id: employee.id,
      name: employee.name,
      manager_id: employee.manager_id,
    }))
  )
);
```

- [ ] **Step 4: Migrate representative query tests**

In `packages/teta/tests/query.test.ts`, convert nested data-first calls to `pipe`. For example:

```ts
const query = pipe(
  users,
  leftJoin(orders, (user, order) => eq(user.id, order.user_id)),
  map((row) => ({
    user_id: row.id,
    total: row.total,
  }))
);
```

Convert lateral join examples from:

```ts
join(users, (user) => map(filter(orders, (order) => eq(order.user_id, user.id)), (order) => ({
  order_id: order.order_id,
})), (user, order) => eq(user.id, order.user_id))
```

to:

```ts
pipe(
  users,
  join(
    (user) => pipe(
      orders,
      filter((order) => eq(order.user_id, user.id)),
      map((order) => ({ order_id: order.order_id }))
    ),
    (user, order) => eq(user.id, order.user_id)
  )
)
```

- [ ] **Step 5: Migrate remaining test files using a verification loop**

Run:

```bash
grep -R "\\b\\(map\\|filter\\|fold\\|sort\\|take\\|join\\|leftJoin\\|rightJoin\\|innerJoin\\|fullJoin\\)([A-Za-z0-9_][A-Za-z0-9_]*," -n packages/teta/tests
```

For each match that is not an intentional curried-only negative case in `typecheck.ts` or runtime rejection case in `errors.test.ts`, convert it to `pipe(query, helper(...))`.

The expected final grep output should include only intentional negative data-first uses in:

```text
packages/teta/tests/errors.test.ts
packages/teta/tests/typecheck.ts
```

- [ ] **Step 6: Run focused package tests**

Run:

```bash
bun run --cwd packages/teta check
```

Expected: `202 pass`, `0 fail`, and TypeScript succeeds. If the test count changes only because tests were added in Task 1, record the new pass count in the commit message body.

- [ ] **Step 7: Commit test migration**

```bash
git add packages/teta/tests
git commit -m "test: migrate query helper tests to curried api"
```

## Task 4: Migrate Docs, Examples, And Benchmarks

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`
- Modify: `examples/bun/dialect_report.ts`
- Modify: `examples/deno/runtime_smoke.ts`
- Modify: `examples/node/api_orders.ts`
- Modify: `examples/node/custom_dialect.ts`
- Modify: `examples/node/tenant_orders.ts`
- Modify: `benchmarks/render_shared.ts`

- [ ] **Step 1: Update README examples**

In `packages/teta/README.md`, remove text that says helpers are dual-mode. Examples should use `pipe(...)`:

```ts
const activeUsers = pipe(
  users,
  filter((user) => and(eq(user.active, true), gte(user.age, 18))),
  map(pickCols("id", "email")),
  sort((user) => asc(user.email)),
  take(20)
);
```

Deferred shorthand should remain curried:

```ts
const activeUsers = pipe(
  users,
  filter(and(eq($.active, true), gte($.age, 18))),
  map(pickCols("id", "email")),
  sort(asc($.email)),
  take(20)
);
```

- [ ] **Step 2: Update cheatsheet API wording**

In `doc/cheatsheet.md`, replace the opening wording:

```md
Teta is function-first. Query helpers are dual-mode, so you can write either `map(users, fn)`
or `pipe(users, map(fn))`.
```

with:

```md
Teta is function-first. Row-transforming query helpers are curried query steps used with `pipe(...)`.
```

Ensure examples use:

```ts
pipe(users, map((u) => ({ id: u.id })))
```

and not:

```ts
map(users, (u) => ({ id: u.id }))
```

- [ ] **Step 3: Update examples**

Convert data-first selected-helper calls in example files to `pipe`. For `examples/deno/runtime_smoke.ts`, the query should follow:

```ts
const result = toSqlResult(
  pipe(
    users,
    filter((user) => eq(user.active, true)),
    map((user) => ({ id: user.id, name: user.name })),
    take(5)
  ),
  { dialect: "postgresql" }
);
```

For Node examples, preserve existing parameter logic and wrap query building in `pipe(...)`:

```ts
const query = pipe(
  orders,
  filter((order) => eq(order.tenant_id, param(tenantId))),
  filter((order) => eq(order.status, "paid")),
  sort((order) => desc(order.id)),
  take(100)
);
```

- [ ] **Step 4: Update benchmark query construction**

In `benchmarks/render_shared.ts`, keep benchmark behavior unchanged while using curried helpers:

```ts
return pipe(
  source,
  filter((row) => and(eq(row.active, true), eq(row.status, "paid"))),
  map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    created_day: row.created_day,
  })),
  sort((row) => [desc(row.created_day), asc(row.id)]),
  take(100)
);
```

- [ ] **Step 5: Verify no docs/examples data-first references remain**

Run:

```bash
grep -R "\\b\\(map\\|filter\\|fold\\|sort\\|take\\|join\\|leftJoin\\|rightJoin\\|innerJoin\\|fullJoin\\)([A-Za-z0-9_][A-Za-z0-9_]*," -n packages/teta/README.md doc/cheatsheet.md examples benchmarks
```

Expected: no matches for removed data-first helper examples. Matches for array `.map(...)`, path `join(...)`, or non-Teta helpers are acceptable only if the matched function is not imported from `@teta/teta`.

- [ ] **Step 6: Run full repository check**

Run:

```bash
bun run check
```

Expected: metadata test passes, all teta tests pass, all dev tests pass, and TypeScript succeeds.

- [ ] **Step 7: Commit docs/examples migration**

```bash
git add packages/teta/README.md doc/cheatsheet.md examples benchmarks
git commit -m "docs: use curried query helper examples"
```

## Task 5: Final Verification And Review

**Files:**
- Review all changed files.

- [ ] **Step 1: Verify working tree status**

Run:

```bash
git status --short
```

Expected: no uncommitted tracked changes before final verification. Untracked files outside this worktree are irrelevant.

- [ ] **Step 2: Run full verification**

Run:

```bash
bun run check
```

Expected: metadata test passes, teta test suite passes, dev test suite passes, and TypeScript succeeds.

- [ ] **Step 3: Inspect public API diff**

Run:

```bash
git diff --stat master...HEAD
git diff master...HEAD -- packages/teta/src/edsl/query/builder.ts packages/teta/tests/typecheck.ts packages/teta/tests/errors.test.ts packages/teta/README.md doc/cheatsheet.md
```

Confirm:

- No selected helper has a public overload beginning with `query: Query<...>`.
- `take(count)` remains exported.
- No `limit(...)` helper was added.
- `union`, `unionAll`, `loop`, and `unnest` were not simplified in this change.

- [ ] **Step 4: Request code review**

Use superpowers:requesting-code-review with:

- Base SHA: the commit before Task 1.
- Head SHA: current branch HEAD.
- Scope: full removal of data-first support for selected query helpers.
- Focus areas: type overload correctness, join ambiguity handling, runtime error quality, migrated tests/docs/examples, no accidental `limit` API.

- [ ] **Step 5: Address review findings**

If review finds Critical or Important issues, fix them with TDD where behavior changes are involved, rerun:

```bash
bun run check
```

Then request focused re-review for the fixes.

- [ ] **Step 6: Finish branch**

After review approval and passing verification, use superpowers:finishing-a-development-branch to offer merge/PR/keep/discard options.
