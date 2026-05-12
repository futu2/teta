# Typed Column Reference API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `col`, `leftCol`, and `rightCol` as type-checkable deferred column helpers while keeping `$`, `$left`, and `$right` compatible.

**Architecture:** Extend `ExprRef` with phantom dependency metadata that records deferred column names by scope. The new string-literal helpers create the same runtime `deferred_column` nodes as the proxy API, while query helper overloads validate recorded dependencies against the typed query context.

**Tech Stack:** TypeScript 5.9, Bun test runner, Teta query EDSL.

---

## File Structure

- Modify `packages/teta/src/edsl/core/expr/runtime.ts`: add phantom dependency types to `ExprRef`, plus dependency merge helpers used by expression operators.
- Modify `packages/teta/src/edsl/core/expr/deferred.ts`: add `col`, `leftCol`, `rightCol`, and keep `$`, `$left`, `$right`.
- Modify `packages/teta/src/edsl/core/expr.ts`: export new dependency types and new helpers.
- Modify selected expression helper files so dependencies survive composition:
  - `packages/teta/src/edsl/sql/expr/ops/comparison.ts`
  - `packages/teta/src/edsl/sql/expr/ops/string.ts`
  - `packages/teta/src/edsl/sql/expr/ops/aggregate.ts`
  - `packages/teta/src/edsl/sql/expr/ops/math.ts`
- Modify `packages/teta/src/edsl/query/builder.ts`: add query-context dependency guards to deferred overloads for `filter`, `map`, `fold`, `sort`, `unnest`, `join`, `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin`.
- Modify `packages/teta/tests/typecheck.ts`: add compile-time failure cases and success inference cases.
- Modify `packages/teta/tests/deferred_proxy.test.ts`: add runtime SQL equivalence tests for `col` helpers.
- Modify docs after implementation:
  - `packages/teta/README.md`
  - `doc/cheatsheet.md`

## Task 1: Add Failing Type Tests

**Files:**
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add imports and failing cases**

Update the import from `../mod.ts` to include `col`, `leftCol`, and `rightCol` next to `$`, `$left`, and `$right`:

```ts
import { filter, fullJoin, innerJoin, join, leftJoin, rightJoin, take, sort, param, map, table, t, fold, asc, desc, eq, gt, upper, add, coalesce, count, group, loop, sum, and, sub, caseWhen, when, mapShape, groupShape, lt, unnest, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, toString, toTimestamp, $, $left, $right, col, leftCol, rightCol, pickCols } from "../mod.ts";
```

After `projectedUsersDeferred`, add successful typed `col` usage:

```ts
const projectedUsersCol = pipe(filteredUsers, map({
    id: col("id"),
    name: upper(col("name")),
}));
```

After `const pickedUsers = ...`, add:

```ts
const colFilteredUsers = pipe(users, filter(eq(col("id"), 1)));
const colSortedUsers = pipe(users, sort([asc(col("name")), desc(col("id"))]));
const colAggregatedOrders = pipe(orders, fold({
    user_id: group(col("user_id")),
    total_spend: sum(col("total")),
}));
const colExplodedSessions = unnest(sessions, col("tags"), { value: "tag" });
```

After `mappedJoin`, add:

```ts
const colMappedJoin = pipe(users, leftJoin(
    orders,
    eq(leftCol("id"), rightCol("user_id")),
    {
        user_id: leftCol("id"),
        total: rightCol("total"),
    }
));
```

After existing projected type assertions, add:

```ts
type _ProjectedUsersColKeys = Expect<Equal<keyof typeof projectedUsersCol.columns, "id" | "name">>;
type _ProjectedUsersColId = Expect<Equal<ExprType<typeof projectedUsersCol.columns.id>, SqlInt>>;
type _ProjectedUsersColName = Expect<Equal<ExprType<typeof projectedUsersCol.columns.name>, string>>;
type _ColFilteredUsersId = Expect<Equal<ExprType<typeof colFilteredUsers.columns.id>, SqlInt>>;
type _ColSortedUsersName = Expect<Equal<ExprType<typeof colSortedUsers.columns.name>, string>>;
type _ColAggregatedOrdersTotalSpend = Expect<Equal<ExprType<typeof colAggregatedOrders.columns.total_spend>, SqlFloat>>;
type _ColExplodedSessionsTag = Expect<Equal<ExprType<typeof colExplodedSessions.columns.tag>, string>>;
type _ColMappedJoinUserId = Expect<Equal<ExprType<typeof colMappedJoin.columns.user_id>, SqlInt>>;
type _ColMappedJoinTotal = Expect<Equal<ExprType<typeof colMappedJoin.columns.total>, SqlFloat | null>>;
```

Add `void` lines near similar existing `void` statements:

```ts
void projectedUsersCol;
void colFilteredUsers;
void colSortedUsers;
void colAggregatedOrders;
void colExplodedSessions;
void colMappedJoin;
```

Near the existing deferred `@ts-expect-error` cases, add:

```ts
pipe(users, filter(
    // @ts-expect-error col rejects unknown current-row columns in filter context
    eq(col("missing"), 1)
));
pipe(users, map({
    // @ts-expect-error col rejects unknown current-row columns in map context
    missing: col("missing"),
}));
pipe(orders, fold({
    // @ts-expect-error col rejects unknown current-row columns in fold context
    total: sum(col("missing")),
}));
pipe(users, sort(
    // @ts-expect-error col rejects unknown current-row columns in sort context
    asc(col("missing"))
));
// @ts-expect-error col rejects unknown current-row columns in unnest context
unnest(sessions, col("missing"), { value: "tag" });
pipe(users, leftJoin(
    orders,
    // @ts-expect-error leftCol rejects unknown join-left columns
    eq(leftCol("missing"), rightCol("user_id"))
));
pipe(users, leftJoin(
    orders,
    // @ts-expect-error rightCol rejects unknown join-right columns
    eq(leftCol("id"), rightCol("missing"))
));
pipe(users, leftJoin(
    orders,
    eq(leftCol("id"), rightCol("user_id")),
    {
        // @ts-expect-error leftCol rejects unknown join-left columns in merge shapes
        user_id: leftCol("missing"),
    }
));
pipe(users, leftJoin(
    orders,
    eq(leftCol("id"), rightCol("user_id")),
    {
        // @ts-expect-error rightCol rejects unknown join-right columns in merge shapes
        total: rightCol("missing"),
    }
));
```

- [ ] **Step 2: Run typecheck to verify red**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: fail because `col`, `leftCol`, and `rightCol` are not exported yet, or because the new `@ts-expect-error` directives are unused after stubbing exports.

- [ ] **Step 3: Commit red tests**

Do not commit if the repo policy forbids failing commits. Otherwise:

```bash
git add packages/teta/tests/typecheck.ts
git commit -m "test: add typed column ref type cases"
```

## Task 2: Add Runtime Helpers and Phantom Types

**Files:**
- Modify: `packages/teta/src/edsl/core/expr/runtime.ts`
- Modify: `packages/teta/src/edsl/core/expr/deferred.ts`
- Modify: `packages/teta/src/edsl/core/expr.ts`

- [ ] **Step 1: Add phantom dependency types to `runtime.ts`**

In `packages/teta/src/edsl/core/expr/runtime.ts`, replace the existing empty `ExprRef` interface and class with:

```ts
export type DeferredExprDeps = {
  current?: Record<string, unknown>;
  left?: Record<string, unknown>;
  right?: Record<string, unknown>;
};

export type EmptyDeferredExprDeps = Record<never, never>;

export type DeferredExprDepScope = keyof DeferredExprDeps;

export type DeferredExprDepsOf<TExpr> = TExpr extends ExprRef<unknown, infer TDeps>
  ? TDeps
  : EmptyDeferredExprDeps;

type MergeDeferredExprDeps<TLeft, TRight> = {
  [K in DeferredExprDepScope as K extends keyof TLeft | keyof TRight ? K : never]:
    (K extends keyof TLeft ? TLeft[K] : EmptyDeferredExprDeps)
      & (K extends keyof TRight ? TRight[K] : EmptyDeferredExprDeps);
};

type MergeDeferredExprDepsTuple<TItems extends readonly unknown[]> =
  TItems extends readonly [infer THead, ...infer TTail]
    ? MergeDeferredExprDeps<DeferredExprDepsOf<THead>, MergeDeferredExprDepsTuple<TTail>>
    : EmptyDeferredExprDeps;

export type DeferredExprDepsForArgs<TItems extends readonly unknown[]> =
  MergeDeferredExprDepsTuple<TItems>;

export interface ExprRef<T, TDeps extends DeferredExprDeps = EmptyDeferredExprDeps> {
  readonly __tetaDeferredExprDeps?: TDeps;
}

export class ExprRef<T, TDeps extends DeferredExprDeps = EmptyDeferredExprDeps> {
  constructor(readonly node: ExprNode<T>) {}
}
```

Leave all runtime constructors unchanged except where TypeScript requires a second generic.

- [ ] **Step 2: Add named deferred column helpers**

In `packages/teta/src/edsl/core/expr/deferred.ts`, import `DeferredExprDepScope`:

```ts
import { ColumnRef, ExprRef, type ColumnRefs, type DeferredExprDepScope } from "./runtime.ts";
```

Add these types after imports:

```ts
type DeferredColumnDeps<
  TScope extends DeferredExprDepScope,
  TName extends string,
> = {
  [K in TScope]: Record<TName, unknown>;
};
```

Add exports after `$right`:

```ts
export function col<const TName extends string>(
  name: TName
): ExprRef<any, DeferredColumnDeps<"current", TName>> {
  return deferredColumn("current", name);
}

export function leftCol<const TName extends string>(
  name: TName
): ExprRef<any, DeferredColumnDeps<"left", TName>> {
  return deferredColumn("left", name);
}

export function rightCol<const TName extends string>(
  name: TName
): ExprRef<any, DeferredColumnDeps<"right", TName>> {
  return deferredColumn("right", name);
}
```

Change `deferredColumn` to:

```ts
function deferredColumn<TScope extends DeferredColumnScope, TName extends string>(
  scope: TScope,
  name: TName
): ExprRef<any, DeferredColumnDeps<TScope, TName>> {
  return new ExprRef<any, DeferredColumnDeps<TScope, TName>>({
    kind: "deferred_column",
    scope,
    name,
  } as ExprNode<any>);
}
```

Keep `DeferredRowProxy` broad so `$` remains compatible:

```ts
type DeferredRowProxy = {
  readonly [K in string]: ExprRef<any>;
};
```

- [ ] **Step 3: Export new types**

In `packages/teta/src/edsl/core/expr.ts`, add these type exports from `./expr/core.ts`:

```ts
type DeferredExprDeps,
type DeferredExprDepsForArgs,
type DeferredExprDepsOf,
type DeferredExprDepScope,
type EmptyDeferredExprDeps,
```

`col`, `leftCol`, and `rightCol` are exported automatically through `export * from "./expr/deferred.ts";`.

- [ ] **Step 4: Run focused typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: still fail because expression helpers and query helper guards are not implemented yet, but no missing export errors for `col`, `leftCol`, or `rightCol`.

## Task 3: Preserve Dependencies Through Expression Helpers

**Files:**
- Modify: `packages/teta/src/edsl/core/expr/runtime.ts`
- Modify: `packages/teta/src/edsl/sql/expr/ops/comparison.ts`
- Modify: `packages/teta/src/edsl/sql/expr/ops/string.ts`
- Modify: `packages/teta/src/edsl/sql/expr/ops/aggregate.ts`
- Modify: `packages/teta/src/edsl/sql/expr/ops/math.ts`

- [ ] **Step 1: Preserve dependencies in generic builders**

In `runtime.ts`, change `fn` to:

```ts
export function fn<
  T = unknown,
  const TArgs extends readonly ExprInput<unknown>[] = readonly ExprInput<unknown>[],
>(
  name: string,
  ...args: TArgs
): ExprRef<T, DeferredExprDepsForArgs<TArgs>> {
  if (!name.trim()) {
    userError("INVALID_FUNCTION_NAME", "fn requires a function name");
  }
  return funcExpr(name, args.map((arg) => toExprNode(arg))) as ExprRef<T, DeferredExprDepsForArgs<TArgs>>;
}
```

Change `aggregateExpr` to:

```ts
export function aggregateExpr<T, TArg extends ExprInput<unknown>>(
  name: AggFunc,
  arg: TArg
): ExprRef<T, DeferredExprDepsForArgs<[TArg]>> {
  return new ExprRef<T, DeferredExprDepsForArgs<[TArg]>>({
    kind: "agg",
    name,
    arg: toExprNode(arg),
    distinct: false,
  });
}
```

Change `binaryExpr` to accept optional dependency typing at call sites:

```ts
export function binaryExpr<TDeps extends DeferredExprDeps = EmptyDeferredExprDeps>(
  op: BinaryOp,
  left: ExprNode<unknown>,
  right: ExprNode<unknown>
): ExprRef<unknown, TDeps> {
  return new ExprRef<unknown, TDeps>({ kind: "binary", op, left, right });
}
```

- [ ] **Step 2: Preserve dependencies in comparison helpers**

In `packages/teta/src/edsl/sql/expr/ops/comparison.ts`, import `DeferredExprDepsForArgs`:

```ts
import {
  ExprRef,
  binaryExpr,
  toExprNode,
  type DeferredExprDepsForArgs,
  type ExprInput,
} from "../core.ts";
```

Update these functions to return dependency-preserving refs:

```ts
export function eq<T, TLeft extends ExprInput<T>, TRight extends ExprInput<T>>(
  left: TLeft,
  right: TRight
): ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>> {
  return binaryExpr<DeferredExprDepsForArgs<[TLeft, TRight]>>(
    "=",
    toExprNode(left as ExprInput<T>),
    toExprNode(right as ExprInput<T>)
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TLeft, TRight]>>;
}
```

Apply the same shape to `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `and`, `or`, `not`, `isNull`, and `isNotNull`. For `isIn`, use:

```ts
export function isIn<T, TValue extends ExprInput<T>, const TValues extends readonly ExprInput<T>[]>(
  value: TValue,
  values: TValues
): ExprRef<boolean, DeferredExprDepsForArgs<[TValue, ...TValues]>> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", "in requires at least one value");
  }
  return binaryExpr<DeferredExprDepsForArgs<[TValue, ...TValues]>>(
    "IN",
    toExprNode(value as ExprInput<T>),
    {
      kind: "list",
      items: values.map((item) => toExprNode(item as ExprInput<T>)),
    }
  ) as ExprRef<boolean, DeferredExprDepsForArgs<[TValue, ...TValues]>>;
}
```

- [ ] **Step 3: Preserve dependencies in string helpers**

In `packages/teta/src/edsl/sql/expr/ops/string.ts`, no runtime logic changes are needed if `fn` now preserves dependency metadata. Update return annotations only where TypeScript cannot infer them from `fn`.

For `upper`, use:

```ts
export function upper<TValue extends NullableString, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<TValue, string>, DeferredExprDepsForArgs<[TInput]>> {
  return fn<PropagateNull<TValue, string>, [TInput]>("UPPER", value);
}
```

Apply this exact pattern to `lower`, `reverse`, `trim`, `charLength`, `characterLength`, `octetLength`, `bitLength`, `left`, and `right`.

- [ ] **Step 4: Preserve dependencies in aggregate helpers**

In `packages/teta/src/edsl/sql/expr/ops/aggregate.ts`, update core aggregate wrappers to preserve dependencies:

```ts
export function group<T, TInput extends ExprInput<T>>(
  value: TInput
): ExprRef<T, DeferredExprDepsForArgs<[TInput]>> {
  return new ExprRef<T, DeferredExprDepsForArgs<[TInput]>>({ kind: "group", expr: toExprNode(value as ExprInput<T>) as any });
}

export function sum<TValue extends NullableSqlNumber, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<TValue, DeferredExprDepsForArgs<[TInput]>> {
  return aggregateExpr<TValue, TInput>("SUM", value);
}
```

Apply the same pattern to `count`, `avg`, `min`, `max`, and `arrayAgg`.

- [ ] **Step 5: Preserve dependencies in math casts used by typecheck**

In `packages/teta/src/edsl/sql/expr/ops/math.ts`, import `DeferredExprDepsForArgs` and update `toString` because `typecheck.ts` already uses it:

```ts
export function toString<TValue, TInput extends ExprInput<TValue>>(
  value: TInput
): ExprRef<PropagateNull<TValue, string>, DeferredExprDepsForArgs<[TInput]>> {
  return cast<PropagateNull<TValue, string>>(value, "VARCHAR") as ExprRef<
    PropagateNull<TValue, string>,
    DeferredExprDepsForArgs<[TInput]>
  >;
}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: typecheck may still fail because query-context guards are not implemented. It should not fail in expression helper implementation files.

## Task 4: Add Query Context Type Guards

**Files:**
- Modify: `packages/teta/src/edsl/query/builder.ts`

- [ ] **Step 1: Import dependency metadata**

Add `DeferredExprDepsOf` to the type import from `../expr.ts`:

```ts
import type {
  ColumnRefs,
  DeferredExprDepsOf,
  ExprRefs,
  ProjectionResult,
  ProjectionShape,
  ProjectionValue,
} from "../expr.ts";
```

- [ ] **Step 2: Add guard types after `type QueryColumns`**

Insert:

```ts
type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LeftDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { left?: infer TLeft }
  ? TLeft
  : Record<never, never>;

type RightDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { right?: infer TRight }
  ? TRight
  : Record<never, never>;

type KnownDeferredCurrentColumnsGuard<
  TColumns extends QueryColumns,
  TExpr,
> = [Exclude<keyof CurrentDepsOf<TExpr>, keyof TColumns>] extends [never]
  ? unknown
  : {
      __teta_unknown_deferred_current_columns__: Exclude<
        keyof CurrentDepsOf<TExpr>,
        keyof TColumns
      >;
    };

type KnownDeferredJoinColumnsGuard<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TExpr,
> = ([Exclude<keyof LeftDepsOf<TExpr>, keyof TLeft>] extends [never]
    ? unknown
    : {
        __teta_unknown_deferred_left_columns__: Exclude<
          keyof LeftDepsOf<TExpr>,
          keyof TLeft
        >;
      })
  & ([Exclude<keyof RightDepsOf<TExpr>, keyof TRight>] extends [never]
    ? unknown
    : {
        __teta_unknown_deferred_right_columns__: Exclude<
          keyof RightDepsOf<TExpr>,
          keyof TRight
        >;
      });

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

type KnownDeferredCurrentSelectionGuard<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = UnionToIntersection<{
  [K in keyof TSelection]: KnownDeferredCurrentColumnsGuard<TColumns, TSelection[K]>;
}[keyof TSelection]>;

type KnownDeferredJoinSelectionGuard<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = UnionToIntersection<{
  [K in keyof TSelection]: KnownDeferredJoinColumnsGuard<TLeft, TRight, TSelection[K]>;
}[keyof TSelection]>;
```

- [ ] **Step 3: Add guarded deferred input aliases**

After `DeferredExprInput`, add:

```ts
type DeferredCurrentExprInput<TColumns extends QueryColumns, TExpr> =
  DeferredExprInput<TExpr> & KnownDeferredCurrentColumnsGuard<TColumns, TExpr>;

type DeferredJoinExprInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TExpr,
> = DeferredExprInput<TExpr> & KnownDeferredJoinColumnsGuard<TLeft, TRight, TExpr>;

type OrderItemExpr<TItem> = TItem extends OrderItem
  ? TItem["expr"] extends ExprRef<infer TValue, infer TDeps>
    ? ExprRef<TValue, TDeps>
    : never
  : never;

type SortExprRefs<TInput> = TInput extends readonly unknown[]
  ? OrderItemExpr<TInput[number]>
  : OrderItemExpr<TInput>;
```

- [ ] **Step 4: Guard `map` and `fold` returned query steps**

Change the deferred `map` overload to:

```ts
export function map<const Sel extends Record<string, unknown>>(
  selection: NonCallableSelection<Sel> & DeferredProjectionShapeInput<Sel>
): <TColumns extends QueryColumns>(
  query: Query<TColumns> & KnownDeferredCurrentSelectionGuard<TColumns, Sel>
) => Query<ProjectionResult<DefinedProjectionShape<Sel>>>;
```

Change the deferred `fold` overload the same way.

- [ ] **Step 5: Guard `filter` and `sort` returned query steps**

Replace the deferred `filter` overload with:

```ts
export function filter<TColumns extends QueryColumns, TExpr extends ExprRef<boolean>>(
  predicate: TExpr
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<TColumns, TExpr>
) => Query<TColumns>;
```

Replace the deferred `sort` overload with:

```ts
export function sort<TColumns extends QueryColumns, TSelector extends OrderItem | OrderItem[]>(
  selector: TSelector
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<TColumns, SortExprRefs<TSelector>>
) => Query<TColumns>;
```

- [ ] **Step 6: Guard `unnest` deferred overloads**

For the data-first deferred overload, use:

```ts
export function unnest<
  TLeft extends QueryColumns,
  TSelector extends ExprRef<readonly unknown[] | unknown[] | null>,
  TValueName extends string,
  TOrdinalityName extends string | undefined = undefined,
  TOuter extends boolean | undefined = undefined,
>(
  left: Query<TLeft>,
  selector: DeferredCurrentExprInput<TLeft, TSelector>,
  selection: UnnestSelection<TValueName, TOrdinalityName>,
  options?: UnnestOptions<TOuter>
): Query<
  TLeft & UnnestGeneratedColumns<
    CollectionItem<DeferredExprValue<TSelector>>,
    TValueName,
    TOrdinalityName,
    TOuter
  >
>;
```

For the curried deferred overload, use the same `selector` type and return `QueryStep<TLeft, ...>`.

- [ ] **Step 7: Guard join predicate and merge overloads**

Add:

```ts
type DeferredJoinOnNoMergeInput<
  TLeft extends QueryColumns,
  TRight extends QueryColumns,
  TExpr,
> = DeferredJoinExprInput<TLeft, TRight, TExpr> & JoinNoMergeGuard<TLeft, TRight>;
```

For `join`, `innerJoin`, `leftJoin`, `rightJoin`, and `fullJoin`, add `TOn extends ExprRef<boolean> = ExprRef<boolean>` to deferred predicate overloads and change:

```ts
on: JoinOnNoMergeInput<TLeft, TRight>
```

to:

```ts
on: JoinOnNoMerge<TLeft, TRight> | DeferredJoinOnNoMergeInput<TLeft, TRight, TOn>
```

For merge overloads that accept object shapes, change:

```ts
merge: DeferredJoinSelection<Sel>
```

to:

```ts
merge: DeferredJoinSelection<Sel> & KnownDeferredJoinSelectionGuard<TLeft, TRight, Sel>
```

- [ ] **Step 8: Run typecheck**

Run:

```bash
bun run --cwd packages/teta typecheck
```

Expected: PASS. If inference chooses `TLeft = Query` instead of the pipe input row type for join overloads, move the join guards from the `on` parameter to the returned `QueryStep` parameter:

```ts
): (
  query: Query<TLeft> & KnownDeferredJoinColumnsGuard<TLeft, TRight, TOn>
) => Query<TMerged>;
```

Use this returned-step guard for all join overloads if needed.

## Task 5: Add Runtime Equivalence Tests

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`

- [ ] **Step 1: Import new helpers**

Add `col`, `leftCol`, and `rightCol` to the import from `../mod.ts`.

- [ ] **Step 2: Add `col` equivalence test**

After `"matches callback SQL for filter, map, sort, and take"`, add:

```ts
test("matches callback SQL for typed col filter, map, sort, and take", () => {
  const users = createUsersPipelineTable();
  const expected = pipe(
    users,
    filter((user) => and(eq(user.active, true), gte(user.age, 18))),
    map((user) => ({
      id: user.id,
      name: coalesce(replace(user.name, " ", "_"), "unknown"),
      age: user.age,
    })),
    sort((row) => [asc(row.name), desc(row.id)]),
    take(20)
  );
  const actual = pipe(
    users,
    filter(and(eq(col("active"), true), gte(col("age"), 18))),
    map({
      id: col("id"),
      name: coalesce(replace(col("name"), " ", "_"), "unknown"),
      age: col("age"),
    }),
    sort([asc(col("name")), desc(col("id"))]),
    take(20)
  );

  expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
    toSql(expected, { dialect: "postgresql", format: "compact" })
  );
});
```

- [ ] **Step 3: Add aggregate and unnest equivalence tests**

After the existing fold and unnest deferred tests, add `col` versions:

```ts
test("matches callback SQL for typed col fold aggregations", () => {
  const orders = createOrdersTable();
  const expected = pipe(orders, fold((order) => ({
    user_id: group(order.user_id),
    order_count: count(order.order_id),
    total_spend: sum(order.total),
  })));
  const actual = pipe(orders, fold({
    user_id: group(col("user_id")),
    order_count: count(col("order_id")),
    total_spend: sum(col("total")),
  }));

  expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
    toSql(expected, { dialect: "postgresql", format: "compact" })
  );
});

test("matches callback SQL for typed col unnest", () => {
  const sessions = table("sessions", {
    id: t.int(),
    tags: t.array(t.string()),
  });
  const expected = unnest(sessions, (session) => session.tags, { value: "tag" });
  const actual = unnest(sessions, col("tags"), { value: "tag" });

  expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
    toSql(expected, { dialect: "postgresql", format: "compact" })
  );
});
```

- [ ] **Step 4: Add join equivalence tests**

After existing join deferred tests, add:

```ts
test("matches callback SQL for typed join column refs", () => {
  const users = createUsersTable();
  const orders = createOrdersTable();
  const expected = pipe(
    users,
    leftJoin(
      orders,
      (user, order) => eq(user.id, order.user_id),
      (user, order) => ({
        user_id: user.id,
        order_total: order.total,
      })
    )
  );
  const actual = pipe(
    users,
    leftJoin(
      orders,
      eq(leftCol("id"), rightCol("user_id")),
      {
        user_id: leftCol("id"),
        order_total: rightCol("total"),
      }
    )
  );

  expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
    toSql(expected, { dialect: "postgresql", format: "compact" })
  );
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: both pass.

## Task 6: Update Documentation

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`

- [ ] **Step 1: Update README imports and examples**

In `packages/teta/README.md`, update the deferred import example from:

```ts
import { $, and, asc, eq, filter, gte, map, pickCols, sort } from "@teta/teta";
```

to:

```ts
import { and, asc, col, eq, filter, gte, map, pickCols, sort } from "@teta/teta";
```

Change any example using `$.name` to `col("name")`, and add one sentence:

```md
Use `col("name")`, `leftCol("name")`, and `rightCol("name")` for no-callback column refs that can be checked by TypeScript in query context. `$`, `$left`, and `$right` remain available as runtime-checked shorthand.
```

- [ ] **Step 2: Update cheatsheet exports and examples**

In `doc/cheatsheet.md`, add `col`, `leftCol`, and `rightCol` to the import list near `$`, `$left`, and `$right`.

Add a short API section near the existing deferred/projection material:

```md
Typed deferred column refs:

- `col("name")` for current-row helpers
- `leftCol("name")` for join-left refs
- `rightCol("name")` for join-right refs

Prefer these over `$`, `$left`, and `$right` when you want TypeScript/LSP errors for misspelled column names.
```

- [ ] **Step 3: Run docs-adjacent checks**

Run:

```bash
bun run check:metadata
bun run --cwd packages/teta typecheck
```

Expected: both pass.

## Task 7: Final Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run package checks**

Run:

```bash
bun run --cwd packages/teta check
```

Expected: tests and typecheck pass.

- [ ] **Step 2: Run full repo typecheck**

Run:

```bash
bun run typecheck
```

Expected: all workspace typechecks pass.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git diff -- packages/teta/src/edsl/core/expr/runtime.ts packages/teta/src/edsl/core/expr/deferred.ts packages/teta/src/edsl/core/expr.ts packages/teta/src/edsl/sql/expr/ops/comparison.ts packages/teta/src/edsl/sql/expr/ops/string.ts packages/teta/src/edsl/sql/expr/ops/aggregate.ts packages/teta/src/edsl/sql/expr/ops/math.ts packages/teta/src/edsl/query/builder.ts packages/teta/tests/typecheck.ts packages/teta/tests/deferred_proxy.test.ts packages/teta/README.md doc/cheatsheet.md
```

Expected: diff only contains typed column ref API, tests, and docs.

- [ ] **Step 4: Commit implementation**

Do not include unrelated existing `package.json` or `bun.lock` changes unless they are part of this work. Commit only relevant files:

```bash
git add packages/teta/src/edsl/core/expr/runtime.ts \
  packages/teta/src/edsl/core/expr/deferred.ts \
  packages/teta/src/edsl/core/expr.ts \
  packages/teta/src/edsl/sql/expr/ops/comparison.ts \
  packages/teta/src/edsl/sql/expr/ops/string.ts \
  packages/teta/src/edsl/sql/expr/ops/aggregate.ts \
  packages/teta/src/edsl/sql/expr/ops/math.ts \
  packages/teta/src/edsl/query/builder.ts \
  packages/teta/tests/typecheck.ts \
  packages/teta/tests/deferred_proxy.test.ts \
  packages/teta/README.md \
  doc/cheatsheet.md \
  docs/superpowers/specs/2026-05-12-typed-column-ref-api-design.md \
  docs/superpowers/plans/2026-05-12-typed-column-ref-api.md
git commit -m "feat: add typed column ref helpers"
```

## Self-Review

- Spec coverage: public API, type behavior, runtime behavior, compatibility, tests, and docs are each covered by tasks.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: the plan uses `col`, `leftCol`, and `rightCol` consistently, and uses the existing `ExprRef`, `DeferredResolutionScope`, and query helper overload architecture.

