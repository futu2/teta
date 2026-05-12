# Remove Remeda Dependency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `remeda` from Teta and provide Teta-owned `pipe`, direct `pickCols`, and `mapCols` helpers.

**Architecture:** Add a tiny public pipeline utility and column projection helper module inside `packages/teta/src/edsl`. Keep query-stage composition curried-only, but make `pickCols` and `mapCols` callable both as row selectors and direct query steps. Replace the remaining internal `purry` use with explicit overload dispatch for `union`, `unionAll`, and `loop`.

**Tech Stack:** TypeScript, Bun test runner, Teta query EDSL, existing public `mod.ts` entrypoint.

---

## File Structure

- Create `packages/teta/src/edsl/pipe.ts` for the public `pipe(value, ...steps)` helper.
- Create `packages/teta/src/edsl/query/projection_helpers.ts` for public `pickCols` and `mapCols`.
- Modify `packages/teta/src/edsl/core/expr/deferred.ts` to remove the old `pickCols` implementation from the expression layer.
- Modify `packages/teta/src/edsl/query.ts` to export `pickCols` and `mapCols` from the query helper module.
- Modify `packages/teta/mod.ts` to export typed `pipe`, `pickCols`, and `mapCols`.
- Modify `packages/teta/src/edsl/query/builder.ts` to remove the `purry` import and replace `union`, `unionAll`, and `loop` runtime dispatch.
- Modify tests in `packages/teta/tests/deferred_proxy.test.ts`, `packages/teta/tests/query.test.ts`, `packages/teta/tests/typecheck.ts`, and existing Remeda-importing tests to import `pipe` from `../mod.ts`.
- Modify docs/examples that currently import `pipe`, `pick`, `mapKeys`, or `omit` from `remeda`.
- Modify `package.json`, `packages/teta/package.json`, `bun.lock`, and `deno.lock` to remove Remeda.

### Task 1: Write Failing Runtime Tests For Teta Helpers

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`

- [ ] **Step 1: Replace the Remeda pipe import in the test file**

Change the top of `packages/teta/tests/deferred_proxy.test.ts` from:

```ts
import { pipe } from "remeda";
import {
  $,
```

to:

```ts
import {
  $,
```

and add `pipe` and `mapCols` to the existing `../mod.ts` import list:

```ts
  map,
  mapCols,
  pickCols,
  pipe,
```

- [ ] **Step 2: Add failing tests for direct `pickCols` and `mapCols`**

Insert these tests after the existing `supports pickCols for same-name projection` test:

```ts
  test("supports pickCols as a direct query step", () => {
    const users = createUsersTable();
    const expected = pipe(users, map((user) => ({ id: user.id, name: user.name })));
    const actual = pipe(users, pickCols("id", "name"));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports mapCols as a direct query step", () => {
    const users = createUsersTable();
    const expected = pipe(users, map((user) => ({
      user_id: user.id,
      user_name: user.name,
      user_age: user.age,
      user_active: user.active,
    })));
    const actual = pipe(users, mapCols((key) => `user_${key}`));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports mapCols as a row selector", () => {
    const users = createUsersTable();
    const expected = pipe(users, map((user) => ({
      selected_id: user.id,
      selected_name: user.name,
      selected_age: user.age,
      selected_active: user.active,
    })));
    const actual = pipe(users, map(mapCols((key) => `selected_${key}`)));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 3: Run the focused tests and verify they fail for missing exports**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: FAIL with diagnostics that `pipe` and `mapCols` are not exported by `../mod.ts`, or that direct `pickCols` cannot be used as a query step. If the file fails earlier because `pipe` is not exported, that is the correct red state.

### Task 2: Write Failing Type Tests For Public Helper Inference

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Replace Remeda imports with Teta helpers**

Change:

```ts
import { mapKeys, omit, pick, pipe } from "remeda";
```

to no import. Add `mapCols` and `pipe` to the existing `../mod.ts` value import:

```ts
import { filter, fullJoin, innerJoin, join, leftJoin, rightJoin, take, sort, param, map, mapCols, pipe, table, t, fold, asc, desc, eq, gt, upper, add, coalesce, count, group, loop, sum, and, sub, caseWhen, when, mapShape, groupShape, lt, unnest, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, toString, toTimestamp, $, $left, $right, col, leftCol, rightCol, pickCols } from "../mod.ts";
```

- [ ] **Step 2: Replace Remeda projection cases with Teta-native cases**

Replace this block:

```ts
const remedaPickedSelection = pipe(users, map(pick<typeof users.columns, ["id"]>(["id"])));
const remedaOmittedSelection = pipe(users, map((user) => ({
    ...omit(user, ["name"]),
    upper_name: upper(user.name),
})));
const remedaKeyMappedSelection = pipe(users, map((user) => pipe(
    user,
    mapKeys((key) => "prefix1_" + key),
)));
const remedaTemplateKeyMappedSelection = pipe(users, map((user) => pipe(
    user,
    mapKeys((key) => `prefix1_${key}`),
)));
const remedaTemplateKeyMappedUsage = pipe(remedaTemplateKeyMappedSelection, map((user) => ({
    id: user.prefix1_id,
    name: user.prefix1_name,
})));
const remedaOmittedAggregate = pipe(orders, fold((order) => omit({
    user_id: group(order.user_id),
    order_count: count(order.order_id),
    total_spend: sum(order.total),
}, ["order_count"])));
```

with:

```ts
const directPickedSelection = pipe(users, pickCols("id"));
const selectorPickedSelection = pipe(users, map(pickCols("id", "name")));
const directKeyMappedSelection = pipe(users, mapCols((key) => `prefix1_${key}`));
const selectorKeyMappedSelection = pipe(users, map(mapCols((key) => `prefix2_${key}`)));
const directKeyMappedUsage = pipe(directKeyMappedSelection, map((user) => ({
    id: user.prefix1_id,
    name: user.prefix1_name,
})));
const selectorKeyMappedUsage = pipe(selectorKeyMappedSelection, map((user) => ({
    id: user.prefix2_id,
    name: user.prefix2_name,
})));
const manualOmittedAggregate = pipe(orders, fold((order) => ({
    user_id: group(order.user_id),
    total_spend: sum(order.total),
})));
```

- [ ] **Step 3: Replace Remeda type assertions and void statements**

Replace:

```ts
type _RemedaPickedId = Expect<Equal<ExprType<typeof remedaPickedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedId = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedUpperName = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.upper_name>, string>>;
type _RemedaOmittedAggregateUserId = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.user_id>, SqlInt>>;
type _RemedaOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.total_spend>, SqlFloat>>;
```

with:

```ts
type _DirectPickedId = Expect<Equal<ExprType<typeof directPickedSelection.columns.id>, SqlInt>>;
type _SelectorPickedName = Expect<Equal<ExprType<typeof selectorPickedSelection.columns.name>, string>>;
type _DirectKeyMappedId = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_id>, SqlInt>>;
type _DirectKeyMappedName = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_name>, string>>;
type _SelectorKeyMappedId = Expect<Equal<ExprType<typeof selectorKeyMappedSelection.columns.prefix2_id>, SqlInt>>;
type _SelectorKeyMappedName = Expect<Equal<ExprType<typeof selectorKeyMappedSelection.columns.prefix2_name>, string>>;
type _ManualOmittedAggregateUserId = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.user_id>, SqlInt>>;
type _ManualOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.total_spend>, SqlFloat>>;
```

Replace:

```ts
void remedaPickedSelection;
void remedaOmittedSelection;
void remedaKeyMappedSelection;
void remedaTemplateKeyMappedSelection;
void remedaTemplateKeyMappedUsage;
void remedaOmittedAggregate;
```

with:

```ts
void directPickedSelection;
void selectorPickedSelection;
void directKeyMappedSelection;
void selectorKeyMappedSelection;
void directKeyMappedUsage;
void selectorKeyMappedUsage;
void manualOmittedAggregate;
```

- [ ] **Step 4: Replace negative Remeda key tests**

Replace:

```ts
// @ts-expect-error remeda mapKeys with widened string keys should not expose arbitrary renamed column refs
pipe(remedaKeyMappedSelection, map((user) => ({ broken: user.prefix1_na })));
// @ts-expect-error template-literal mapKeys should still reject unknown renamed fields
pipe(remedaTemplateKeyMappedSelection, map((user) => ({ broken: user.prefix1_na })));
```

with:

```ts
// @ts-expect-error mapCols should reject unknown direct renamed fields
pipe(directKeyMappedSelection, map((user) => ({ broken: user.prefix1_na })));
// @ts-expect-error mapCols should reject unknown selector renamed fields
pipe(selectorKeyMappedSelection, map((user) => ({ broken: user.prefix2_na })));
```

- [ ] **Step 5: Run typecheck and verify the new tests fail**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `pipe` and `mapCols` are not exported yet, and direct `pickCols` does not have query-step typing yet.

### Task 3: Implement Public `pipe`

**Files:**
- Create: `packages/teta/src/edsl/pipe.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Add the pipe utility**

Create `packages/teta/src/edsl/pipe.ts`:

```ts
type UnaryStep<TInput, TOutput> = (input: TInput) => TOutput;

export function pipe<TValue>(value: TValue): TValue;
export function pipe<TValue, T1>(
  value: TValue,
  step1: UnaryStep<TValue, T1>
): T1;
export function pipe<TValue, T1, T2>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>
): T2;
export function pipe<TValue, T1, T2, T3>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>
): T3;
export function pipe<TValue, T1, T2, T3, T4>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>
): T4;
export function pipe<TValue, T1, T2, T3, T4, T5>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>
): T5;
export function pipe<TValue, T1, T2, T3, T4, T5, T6>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>
): T6;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>
): T7;
export function pipe<TValue, T1, T2, T3, T4, T5, T6, T7, T8>(
  value: TValue,
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>
): T8;
export function pipe(value: unknown, ...steps: UnaryStep<unknown, unknown>[]): unknown {
  let current = value;
  for (const step of steps) {
    current = step(current);
  }
  return current;
}
```

- [ ] **Step 2: Export pipe from the public entrypoint**

In `packages/teta/mod.ts`, add near the query exports:

```ts
import * as pipeModule from "./src/edsl/pipe.ts";
```

and add:

```ts
/** Applies unary steps to a value from left to right. */
export const pipe: typeof import("./src/edsl/pipe.ts").pipe = pipeModule.pipe;
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: FAIL remains for missing `mapCols` and direct `pickCols`; existing `pipe` import errors should be gone.

### Task 4: Implement `pickCols` And `mapCols`

**Files:**
- Create: `packages/teta/src/edsl/query/projection_helpers.ts`
- Modify: `packages/teta/src/edsl/core/expr/deferred.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Remove old `pickCols` from deferred expressions**

Delete the `pickCols` function from `packages/teta/src/edsl/core/expr/deferred.ts`. Keep all deferred row proxy functions and imports that remain used. If `ColumnRef` is no longer used in that file, remove it from the import:

```ts
import { ExprRef, type ColumnRefs, type DeferredExprDepScope } from "./runtime.ts";
```

- [ ] **Step 2: Add projection helper module**

Create `packages/teta/src/edsl/query/projection_helpers.ts`:

```ts
import { userError } from "../errors.ts";
import { map, Query, type QueryStep } from "./builder.ts";
import type { ColumnRef, ColumnRefs } from "../expr.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type PickColsProjection<
  TColumns extends QueryColumns,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: ColumnRef<TColumns[K], K>;
};

type PickColsResult<
  TColumns extends QueryColumns,
  TNames extends readonly [string, ...string[]],
> = {
  [K in TNames[number]]: TColumns[K];
};

type RenameResult<
  TColumns extends QueryColumns,
  TRename extends (key: StringKeyOf<TColumns>) => string,
> = {
  [K in StringKeyOf<TColumns> as ReturnType<TRename & ((key: K) => string)>]: TColumns[K];
};

type PickColsHelper<TNames extends readonly [string, ...string[]]> = {
  <TColumns extends Record<TNames[number], any>>(
    cols: ColumnRefs<TColumns>
  ): PickColsProjection<TColumns, TNames>;
  <TColumns extends Record<TNames[number], any>>(
    query: Query<TColumns>
  ): Query<PickColsResult<TColumns, TNames>>;
};

type MapColsHelper<TRename extends (key: string) => string> = {
  <TColumns extends QueryColumns>(
    cols: ColumnRefs<TColumns>
  ): { [K in StringKeyOf<TColumns> as ReturnType<TRename & ((key: K) => string)>]: ColumnRef<TColumns[K], K> };
  <TColumns extends QueryColumns>(
    query: Query<TColumns>
  ): Query<RenameResult<TColumns, TRename & ((key: StringKeyOf<TColumns>) => string)>>;
};

export function pickCols<const TNames extends readonly [string, ...string[]]>(
  ...names: TNames
): PickColsHelper<TNames> {
  function pickSelectedColumns(input: ColumnRefs<QueryColumns> | Query<QueryColumns>): unknown {
    if (input instanceof Query) {
      return map(pickSelectedColumns as (cols: ColumnRefs<QueryColumns>) => Record<string, ColumnRef<any, string>>)(input);
    }

    const result: Record<string, ColumnRef<any, string>> = {};
    for (const name of names) {
      if (!(name in input)) {
        userError(
          "DEFERRED_COLUMN_UNKNOWN",
          `Unknown current row column '${name}'. Available columns: ${Object.keys(input).join(", ")}`
        );
      }
      result[name] = Reflect.get(input, name) as ColumnRef<any, string>;
    }
    return result;
  }

  return pickSelectedColumns as PickColsHelper<TNames>;
}

export function mapCols<const TRename extends (key: string) => string>(
  rename: TRename
): MapColsHelper<TRename> {
  function mapSelectedColumns(input: ColumnRefs<QueryColumns> | Query<QueryColumns>): unknown {
    if (input instanceof Query) {
      return map(mapSelectedColumns as (cols: ColumnRefs<QueryColumns>) => Record<string, ColumnRef<any, string>>)(input);
    }

    const result: Record<string, ColumnRef<any, string>> = {};
    for (const key of Object.keys(input)) {
      result[rename(key)] = Reflect.get(input, key) as ColumnRef<any, string>;
    }
    return result;
  }

  return mapSelectedColumns as MapColsHelper<TRename>;
}
```

- [ ] **Step 3: Export projection helpers through query module**

In `packages/teta/src/edsl/query.ts`, add:

```ts
export { pickCols, mapCols } from "./query/projection_helpers.ts";
```

- [ ] **Step 4: Point public `mod.ts` at query projection helpers**

In `packages/teta/mod.ts`, change the `pickCols` export from:

```ts
/** Builds a same-name projection selector. */
export const pickCols: typeof import("./src/edsl/expr.ts").pickCols = expr.pickCols;
```

to:

```ts
/** Builds a same-name projection selector or query step. */
export const pickCols: typeof import("./src/edsl/query.ts").pickCols = query.pickCols;

/** Renames every projected column with the provided key mapper. */
export const mapCols: typeof import("./src/edsl/query.ts").mapCols = query.mapCols;
```

- [ ] **Step 5: Run focused runtime tests**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
```

Expected: PASS for the new runtime helper tests.

- [ ] **Step 6: Run typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: PASS for helper typings. If the template-literal rename keys widen to `string`, tighten the `TRename` and `RenameResult` generic types until `prefix1_id` and `prefix2_id` are known properties and `prefix1_na` / `prefix2_na` are rejected.

- [ ] **Step 7: Commit helper API work**

Run:

```bash
git add packages/teta/src/edsl/pipe.ts packages/teta/src/edsl/query/projection_helpers.ts packages/teta/src/edsl/core/expr/deferred.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts packages/teta/tests/deferred_proxy.test.ts packages/teta/tests/typecheck.ts
git commit -m "feat: add teta pipe and column projection helpers"
```

### Task 5: Remove Internal `purry`

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`
- Modify: `packages/teta/tests/query.test.ts`

- [ ] **Step 1: Add a regression test for curried union and loop**

In `packages/teta/tests/query.test.ts`, replace:

```ts
import { omit, pick, pipe } from "remeda";
```

with:

```ts
import { omit, pick } from "remeda";
```

Then add `loop`, `pipe`, `union`, and `unionAll` to the existing `../mod.ts` import list.

Add these tests near the other pipeline composition tests:

```ts
    test("supports curried union helpers without Remeda purry", () => {
        const users = table("users", {
            id: t.int(),
            name: t.string(),
        });
        const archivedUsers = table("archived_users", {
            id: t.int(),
            name: t.string(),
        });

        const unioned = pipe(users, union(archivedUsers));
        const unionedAll = pipe(users, unionAll(archivedUsers));

        expect(toSql(unioned, { dialect: "postgresql", format: "compact" })).toContain(" UNION ");
        expect(toSql(unionedAll, { dialect: "postgresql", format: "compact" })).toContain(" UNION ALL ");
    });

    test("supports curried loop helper without Remeda purry", () => {
        const seed = pipe(
            table("seed", { n: t.int() }),
            map((row) => ({ n: row.n }))
        );
        const recursive = pipe(
            seed,
            loop((self) => pipe(self, filter((row) => gt(row.n, 0))))
        );

        expect(toSql(recursive, { dialect: "postgresql", format: "compact" })).toContain("WITH RECURSIVE");
    });
```

- [ ] **Step 2: Run the focused tests before implementation**

Run:

```bash
bun test packages/teta/tests/query.test.ts
```

Expected: PASS before removing `purry`. These tests document behavior that must remain stable during the refactor.

- [ ] **Step 3: Remove Remeda import from builder**

In `packages/teta/src/edsl/query/builder.ts`, delete:

```ts
import { purry } from "remeda";
```

- [ ] **Step 4: Replace `unionAll`, `union`, and `loop` dispatch**

Replace:

```ts
export function unionAll(...args: unknown[]): unknown {
  return purry(_unionAll, args);
}
```

with:

```ts
export function unionAll(...args: unknown[]): unknown {
  if (args.length === 1) {
    const [right] = args;
    return (left: Query<QueryColumns>) => _unionAll(left, right as Query<QueryColumns>);
  }
  const [left, right] = args;
  return _unionAll(left as Query<QueryColumns>, right as Query<QueryColumns>);
}
```

Replace:

```ts
export function union(...args: unknown[]): unknown {
  return purry(_union, args);
}
```

with:

```ts
export function union(...args: unknown[]): unknown {
  if (args.length === 1) {
    const [right] = args;
    return (left: Query<QueryColumns>) => _union(left, right as Query<QueryColumns>);
  }
  const [left, right] = args;
  return _union(left as Query<QueryColumns>, right as Query<QueryColumns>);
}
```

Replace:

```ts
export function loop(...args: unknown[]): unknown {
  return purry(_loop, args);
}
```

with:

```ts
export function loop(...args: unknown[]): unknown {
  if (args.length === 1) {
    const [step] = args;
    return (base: Query<QueryColumns>) =>
      _loop(base, step as (self: Query<QueryColumns>) => Query<QueryColumns>);
  }
  const [base, step] = args;
  return _loop(
    base as Query<QueryColumns>,
    step as (self: Query<QueryColumns>) => Query<QueryColumns>
  );
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
bun test packages/teta/tests/query.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit purry removal**

Run:

```bash
git add packages/teta/src/edsl/query/builder.ts packages/teta/tests/query.test.ts
git commit -m "refactor: remove remeda purry usage"
```

### Task 6: Migrate Tests, Examples, And Active Docs Off Remeda

**Files:**
- Modify: `benchmarks/render_shared.ts`
- Modify: `examples/bun/dialect_report.ts`
- Modify: `examples/deno/runtime_smoke.ts`
- Modify: `examples/node/api_orders.ts`
- Modify: `examples/node/custom_dialect.ts`
- Modify: `examples/node/tenant_orders.ts`
- Modify: `packages/teta/tests/aggregate.test.ts`
- Modify: `packages/teta/tests/duckdb-live.test.ts`
- Modify: `packages/teta/tests/errors.test.ts`
- Modify: `packages/teta/tests/explain.test.ts`
- Modify: `packages/teta/tests/functional_builders.test.ts`
- Modify: `packages/teta/tests/helpers/fixtures.ts`
- Modify: `packages/teta/tests/helpers/live-language-spec-analytic.ts`
- Modify: `packages/teta/tests/helpers/live-language-spec-array.ts`
- Modify: `packages/teta/tests/helpers/live-language-spec-scalar.ts`
- Modify: `packages/teta/tests/loop.test.ts`
- Modify: `packages/teta/tests/query_functional.test.ts`
- Modify: `packages/teta/tests/render_strategy.test.ts`
- Modify: `packages/teta/tests/renderer.test.ts`
- Modify: `packages/teta/tests/runtime_smoke.ts`
- Modify: `packages/teta/tests/values.test.ts`
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/TYPES.md`

- [ ] **Step 1: Replace test and example pipe imports**

For every TypeScript file in this task that contains:

```ts
import { pipe } from "remeda";
```

delete that import and add `pipe` to the file's existing Teta import:

- `benchmarks/render_shared.ts`: add `pipe` to the existing import from `../packages/teta/mod.ts`.
- `examples/bun/dialect_report.ts`: add `pipe` to the existing import from `@teta/teta`.
- `examples/deno/runtime_smoke.ts`: add `pipe` to the existing import from `@teta/teta`.
- `examples/node/api_orders.ts`: add `pipe` to the existing import from `@teta/teta`.
- `examples/node/custom_dialect.ts`: add `pipe` to the existing import from `@teta/teta`.
- `examples/node/tenant_orders.ts`: add `pipe` to the existing import from `@teta/teta`.
- `packages/teta/tests/*.test.ts`: add `pipe` to the existing import from `../mod.ts`.
- `packages/teta/tests/helpers/*.ts`: add `pipe` to the existing import from `../../mod.ts`.

- [ ] **Step 2: Replace Remeda object utility uses in `query.test.ts`**

In `packages/teta/tests/query.test.ts`, remove `omit` and `pick` from the Remeda import. Replace simple `pick(...)` projections with `pickCols(...)` and replace `omit(...)` projections with explicit object literals or destructuring inside the callback.

Use this pattern for explicit omission:

```ts
map((user) => ({
    id: user.id,
    active: user.active,
}))
```

instead of:

```ts
map(omit(["name"] as const))
```

- [ ] **Step 3: Replace docs imports and examples**

In `packages/teta/README.md`, `doc/cheatsheet.md`, `doc/TUTORIAL.md`, and `doc/TYPES.md`:

Replace:

```ts
import { pipe } from "remeda";
```

with a Teta import that includes `pipe`.

Replace Remeda reshaping examples:

```ts
import { mapKeys, pick, pipe } from "remeda";

const namespacedUsers = pipe(
  users,
  map(pipe(
    pick(["id", "name"] as const),
    mapKeys((key) => `user_${key}`)
  ))
);
```

with:

```ts
import { mapCols, pickCols, pipe } from "@teta/teta";

const namespacedUsers = pipe(
  users,
  pickCols("id", "name"),
  mapCols((key) => `user_${key}`)
);
```

Replace text that recommends Remeda with text that says Teta includes `pipe`, `pickCols`, and `mapCols`.

- [ ] **Step 4: Check for remaining active Remeda references**

Run:

```bash
rg -n "from \"remeda\"|from 'remeda'|mapKeys|\\bpick\\(|\\bomit\\(|\\bremeda\\b" -g '!docs/superpowers/**' -g '!bun.lock' -g '!deno.lock' -g '!node_modules/**'
```

Expected: no matches outside `package.json` files until Task 7 removes dependencies.

- [ ] **Step 5: Run package tests**

Run:

```bash
bun run --cwd packages/teta test
```

Expected: PASS.

- [ ] **Step 6: Commit migration**

Run:

```bash
git add benchmarks/render_shared.ts examples packages/teta/tests packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
git commit -m "chore: migrate teta usage off remeda"
```

### Task 7: Remove Remeda From Manifests And Lockfiles

**Files:**
- Modify: `package.json`
- Modify: `packages/teta/package.json`
- Modify: `bun.lock`
- Modify: `deno.lock`

- [ ] **Step 1: Remove package manifest dependencies**

In root `package.json`, remove:

```json
"remeda": "^2.34.0",
```

from `devDependencies`.

In `packages/teta/package.json`, remove:

```json
"remeda": "^2.33.6"
```

from `dependencies`. Ensure the preceding JSON comma is correct.

- [ ] **Step 2: Refresh lockfiles**

Run:

```bash
bun install
deno cache --node-modules-dir=auto packages/teta/tests/runtime_smoke.ts
```

Expected: `bun.lock` and `deno.lock` no longer contain active Remeda package entries.

- [ ] **Step 3: Verify no active Remeda references remain**

Run:

```bash
rg -n "from \"remeda\"|from 'remeda'|npm:remeda|\\bremeda\\b" -g '!docs/superpowers/**' -g '!node_modules/**'
```

Expected: no matches.

- [ ] **Step 4: Run full checks**

Run:

```bash
bun run check
```

Expected: PASS.

- [ ] **Step 5: Commit dependency removal**

Run:

```bash
git add package.json packages/teta/package.json bun.lock deno.lock
git commit -m "chore: remove remeda dependency"
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

- [ ] **Step 3: Run final Remeda scan**

Run:

```bash
rg -n "from \"remeda\"|from 'remeda'|npm:remeda|\\bremeda\\b" -g '!docs/superpowers/**' -g '!node_modules/**'
```

Expected: no matches.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean worktree after all planned commits.
