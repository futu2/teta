# Functional EDSL Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add functional EDSL helpers for reusable pipelines, computed-column extension, variadic boolean expressions, and comparison filter query steps.

**Architecture:** Keep the EDSL function-first. `flow(...)` lives beside `pipe(...)`; `extend(...)` and comparison filter helpers live in focused query helper modules and delegate to existing `map(...)`/`filter(...)`; variadic `and(...)`/`or(...)` update the existing comparison expression operators without changing SQL semantics.

**Tech Stack:** TypeScript, Bun test runner, Teta query EDSL, public `packages/teta/mod.ts` entrypoint.

---

## File Structure

- Modify `packages/teta/src/edsl/pipe.ts` to add `flow(...)` overloads.
- Modify `packages/teta/mod.ts` to export `flow`, `extend`, and comparison filter helpers.
- Modify `packages/teta/src/edsl/query.ts` to export `extend` and comparison filter helpers.
- Create `packages/teta/src/edsl/query/extend.ts` for computed-column extension.
- Create `packages/teta/src/edsl/query/filter_comparison.ts` for `filterEq`, `filterNe`, `filterGt`, `filterGte`, `filterLt`, and `filterLte`.
- Modify `packages/teta/src/edsl/sql/expr/ops/comparison.ts` to make `and(...)` and `or(...)` variadic.
- Modify `packages/teta/tests/query_functional.test.ts` for runtime SQL/API coverage.
- Modify `packages/teta/tests/deferred_proxy.test.ts` for deferred runtime validation coverage.
- Modify `packages/teta/tests/typecheck.ts` for type inference and negative coverage.
- Modify `packages/teta/README.md`, `doc/cheatsheet.md`, `doc/TUTORIAL.md`, and `doc/TYPES.md` for docs.

### Task 1: Add Tests For `flow(...)`

**Files:**
- Modify: `packages/teta/tests/query_functional.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add runtime import**

In `packages/teta/tests/query_functional.test.ts`, add `flow` to the existing import list from `../mod.ts`.

```ts
import { filter, take, sort, map, toSql, asc, desc, eq, gte, replace, and, coalesce, leftJoin, onEq, prefixOverlapLeft, table, t, pipe, flow } from "../mod.ts";
```

- [ ] **Step 2: Add runtime test**

Add this test inside `describe("function-first query api", () => { ... })` after the existing `composes a pipeline with Teta pipe` test:

```ts
    test("composes reusable query steps with Teta flow", () => {
        const users = createUsersPipelineTable();
        const activeUserPipeline = flow(
            filter((user: typeof users.columns) => and(eq(user.active, true), gte(user.age, 18))),
            map((user) => ({
                id: user.id,
                name: coalesce(replace(user.name, " ", "_"), "unknown"),
                age: user.age,
            })),
            sort((row) => [asc(row.name), desc(row.id)]),
            take(20)
        );

        expect(toSql(activeUserPipeline(users), { dialect: "postgresql", format: "compact" })).toBe(USER_PIPELINE_POSTGRES_COMPACT);
    });

    test("composes ordinary functions with Teta flow", () => {
        const addOne = (value: number) => value + 1;
        const toLabel = (value: number) => `n=${value}`;

        expect(flow(addOne, toLabel)(41)).toBe("n=42");
    });
```

- [ ] **Step 3: Add typecheck import**

In `packages/teta/tests/typecheck.ts`, add `flow` to the import list from `../mod.ts`.

```ts
import { filter, fullJoin, innerJoin, join, leftJoin, rightJoin, take, sort, param, map, rename, pipe, flow, table, t, fold, asc, desc, eq, gt, upper, add, coalesce, count, group, loop, sum, and, sub, caseWhen, when, mapShape, groupShape, lt, unnest, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, toString, toTimestamp, $, $left, $right, col, leftCol, rightCol, pick, drop } from "../mod.ts";
```

- [ ] **Step 4: Add typecheck assertions**

Add these values near the other query pipeline examples:

```ts
const flowNumberToString = flow(
    (value: number) => value + 1,
    (value) => `n=${value}`,
);
const flowPipeline = flow(
    filter((user: typeof users.columns) => gt(user.id, 0)),
    pick("id"),
);
const flowPipelineResult = flowPipeline(users);
```

Add these type assertions near the existing `Expect<Equal<...>>` assertions:

```ts
type _FlowNumberToString = Expect<Equal<ReturnType<typeof flowNumberToString>, string>>;
type _FlowPipelineKeys = Expect<Equal<keyof typeof flowPipelineResult.columns, "id">>;
type _FlowPipelineId = Expect<Equal<ExprType<typeof flowPipelineResult.columns.id>, SqlInt>>;
```

Add these void references near the other `void` references:

```ts
void flowNumberToString;
void flowPipeline;
void flowPipelineResult;
```

- [ ] **Step 5: Run tests to verify red state**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts
bun run --cwd packages/teta typecheck
```

Expected: both fail because `flow` is not exported.

- [ ] **Step 6: Commit tests**

Run:

```bash
git add packages/teta/tests/query_functional.test.ts packages/teta/tests/typecheck.ts
git commit -m "test: cover flow helper"
```

### Task 2: Implement `flow(...)`

**Files:**
- Modify: `packages/teta/src/edsl/pipe.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Add `flow(...)` overloads**

In `packages/teta/src/edsl/pipe.ts`, keep the existing `UnaryStep` type and add `flow(...)` overloads after `pipe(...)`:

```ts
export function flow<TValue>(): UnaryStep<TValue, TValue>;
export function flow<TValue, T1>(
  step1: UnaryStep<TValue, T1>
): UnaryStep<TValue, T1>;
export function flow<TValue, T1, T2>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>
): UnaryStep<TValue, T2>;
export function flow<TValue, T1, T2, T3>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>
): UnaryStep<TValue, T3>;
export function flow<TValue, T1, T2, T3, T4>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>
): UnaryStep<TValue, T4>;
export function flow<TValue, T1, T2, T3, T4, T5>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>
): UnaryStep<TValue, T5>;
export function flow<TValue, T1, T2, T3, T4, T5, T6>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>
): UnaryStep<TValue, T6>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>
): UnaryStep<TValue, T7>;
export function flow<TValue, T1, T2, T3, T4, T5, T6, T7, T8>(
  step1: UnaryStep<TValue, T1>,
  step2: UnaryStep<T1, T2>,
  step3: UnaryStep<T2, T3>,
  step4: UnaryStep<T3, T4>,
  step5: UnaryStep<T4, T5>,
  step6: UnaryStep<T5, T6>,
  step7: UnaryStep<T6, T7>,
  step8: UnaryStep<T7, T8>
): UnaryStep<TValue, T8>;
export function flow(...steps: UnaryStep<unknown, unknown>[]): UnaryStep<unknown, unknown> {
  return (value: unknown) => pipe(value, ...steps);
}
```

- [ ] **Step 2: Export `flow` from public entrypoint**

In `packages/teta/mod.ts`, add after the existing `pipe` export:

```ts
/** Composes unary steps from left to right into a reusable function. */
export const flow: typeof import("./src/edsl/pipe.ts").flow = pipeModule.flow;
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
bun test packages/teta/tests/query_functional.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/pipe.ts packages/teta/mod.ts
git commit -m "feat: add teta flow helper"
```

### Task 3: Add Tests For Variadic `and(...)` And `or(...)`

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add runtime import**

In `packages/teta/tests/deferred_proxy.test.ts`, add `isNotNull` after `gte` and add `or` after `map` in the import list from `../mod.ts`:

```ts
  isNotNull,
  or,
```

- [ ] **Step 2: Add runtime tests**

Add these tests near the existing deferred filter tests:

```ts
  test("supports variadic and for deferred filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter(and(and(eq($.active, true), gte($.age, 18)), isNotNull($.name)))
    );
    const actual = pipe(
      users,
      filter(and(eq($.active, true), gte($.age, 18), isNotNull($.name)))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports variadic or for deferred filters", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(
      users,
      filter(or(or(eq($.name, "Ada"), eq($.name, "Grace")), eq($.name, "Linus")))
    );
    const actual = pipe(
      users,
      filter(or(eq($.name, "Ada"), eq($.name, "Grace"), eq($.name, "Linus")))
    );

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 3: Add typecheck import and assertions**

In `packages/teta/tests/typecheck.ts`, add `or` and `isNotNull` to the import list from `../mod.ts`.

Add near the expression examples:

```ts
const variadicAndFilteredUsers = pipe(users, filter(and(eq(col("id"), 1), gt(col("id"), 0), isNotNull(col("name")))));
const variadicOrFilteredUsers = pipe(users, filter(or(eq(col("name"), "Ada"), eq(col("name"), "Grace"), eq(col("name"), "Linus"))));
const singleAndExpr = and(eq(col("id"), 1));
const singleOrExpr = or(eq(col("id"), 1));
```

Add type assertions:

```ts
type _VariadicAndFilteredUsersId = Expect<Equal<ExprType<typeof variadicAndFilteredUsers.columns.id>, SqlInt>>;
type _VariadicOrFilteredUsersName = Expect<Equal<ExprType<typeof variadicOrFilteredUsers.columns.name>, string>>;
type _SingleAndExpr = Expect<Equal<ExprType<typeof singleAndExpr>, boolean>>;
type _SingleOrExpr = Expect<Equal<ExprType<typeof singleOrExpr>, boolean>>;
```

Add negative tests near the existing `@ts-expect-error` block:

```ts
// @ts-expect-error and requires at least one expression
and();
// @ts-expect-error or requires at least one expression
or();
```

Add void references:

```ts
void variadicAndFilteredUsers;
void variadicOrFilteredUsers;
void singleAndExpr;
void singleOrExpr;
```

- [ ] **Step 4: Run tests to verify red state**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `and(...)` and `or(...)` currently require exactly two arguments.

- [ ] **Step 5: Commit tests**

Run:

```bash
git add packages/teta/tests/deferred_proxy.test.ts packages/teta/tests/typecheck.ts
git commit -m "test: cover variadic boolean helpers"
```

### Task 4: Implement Variadic `and(...)` And `or(...)`

**Files:**
- Modify: `packages/teta/src/edsl/sql/expr/ops/comparison.ts`

- [ ] **Step 1: Update imports**

In `packages/teta/src/edsl/sql/expr/ops/comparison.ts`, add `wrapExpr` to the import from `../core.ts`:

```ts
  wrapExpr,
```

- [ ] **Step 2: Replace binary-only `and(...)` and `or(...)`**

Replace the existing `and(...)` and `or(...)` implementations with:

```ts
type BooleanInput = ExprInput<boolean | null>;
type NonEmptyBooleanInputs = readonly [BooleanInput, ...BooleanInput[]];

export function and<const TValues extends NonEmptyBooleanInputs>(
  ...values: TValues
): ExprRef<boolean, DeferredExprDepsForArgs<TValues>> {
  return booleanChain("AND", "and", values) as ExprRef<boolean, DeferredExprDepsForArgs<TValues>>;
}

export function or<const TValues extends NonEmptyBooleanInputs>(
  ...values: TValues
): ExprRef<boolean, DeferredExprDepsForArgs<TValues>> {
  return booleanChain("OR", "or", values) as ExprRef<boolean, DeferredExprDepsForArgs<TValues>>;
}

function booleanChain(
  op: "AND" | "OR",
  name: "and" | "or",
  values: readonly BooleanInput[]
): ExprRef<boolean> {
  if (values.length === 0) {
    userError("INVALID_FUNCTION_NAME", `${name} requires at least one expression`);
  }
  if (values.length === 1) {
    return wrapExpr(values[0] as BooleanInput) as ExprRef<boolean>;
  }

  let current = toExprNode(values[0] as BooleanInput);
  for (const value of values.slice(1)) {
    current = {
      kind: "binary",
      op,
      left: current,
      right: toExprNode(value as BooleanInput),
    };
  }
  return new ExprRef<boolean>(current);
}
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/sql/expr/ops/comparison.ts
git commit -m "feat: make boolean helpers variadic"
```

### Task 5: Add Tests For `extend(...)`

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add runtime import**

In `packages/teta/tests/deferred_proxy.test.ts`, add these names to the import list from `../mod.ts`:

```ts
  caseWhen,
  extend,
  when,
```

- [ ] **Step 2: Add runtime tests**

Add these tests near the projection helper tests:

```ts
  test("supports extend as a direct query step", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      age: user.age,
      active: user.active,
      normalized_name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));
    const actual = pipe(users, extend((user) => ({
      normalized_name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports extend with deferred selection", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: user.name,
      age: user.age,
      active: user.active,
      active_label: caseWhen([when(user.active, "active")], "inactive"),
    })));
    const actual = pipe(users, extend({
      active_label: caseWhen([when($.active, "active")], "inactive"),
    }));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports extend replacing an existing column", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, map((user) => ({
      id: user.id,
      name: coalesce(replace(user.name, " ", "_"), "unknown"),
      age: user.age,
      active: user.active,
    })));
    const actual = pipe(users, extend((user) => ({
      name: coalesce(replace(user.name, " ", "_"), "unknown"),
    })));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 3: Add typecheck import and assertions**

In `packages/teta/tests/typecheck.ts`, add `extend` to the import list.

Add near projection examples:

```ts
const extendedUsers = pipe(users, extend((user) => ({
    name_upper: upper(user.name),
})));
const deferredExtendedUsers = pipe(users, extend({
    name_upper: upper(col("name")),
}));
const replacedExtendedUsers = pipe(users, extend((user) => ({
    id: toString(user.id),
})));
```

Add type assertions:

```ts
type _ExtendedUsersKeys = Expect<Equal<keyof typeof extendedUsers.columns, "id" | "name" | "name_upper">>;
type _ExtendedUsersNameUpper = Expect<Equal<ExprType<typeof extendedUsers.columns.name_upper>, string>>;
type _DeferredExtendedUsersNameUpper = Expect<Equal<ExprType<typeof deferredExtendedUsers.columns.name_upper>, string>>;
type _ReplacedExtendedUsersId = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.id>, string>>;
type _ReplacedExtendedUsersName = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.name>, string>>;
```

Add negative test:

```ts
// @ts-expect-error extend rejects unknown deferred columns when applied to a typed query
pipe(users, extend({ broken: col("missing") }));
```

Add void references:

```ts
void extendedUsers;
void deferredExtendedUsers;
void replacedExtendedUsers;
```

- [ ] **Step 4: Run tests to verify red state**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: FAIL because `extend` is not exported.

- [ ] **Step 5: Commit tests**

Run:

```bash
git add packages/teta/tests/deferred_proxy.test.ts packages/teta/tests/typecheck.ts
git commit -m "test: cover extend helper"
```

### Task 6: Implement `extend(...)`

**Files:**
- Create: `packages/teta/src/edsl/query/extend.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Create `extend.ts`**

Create `packages/teta/src/edsl/query/extend.ts` with:

```ts
import { map, Query } from "./builder.ts";
import type {
  ColumnRef,
  ColumnRefs,
  DeferredExprDepsOf,
  ExprRef,
  ProjectionResult,
  ProjectionShape,
  ProjectionValue,
  ProjectionValueResult,
} from "../expr.ts";

type QueryColumns = Record<string, any>;
type StringKeyOf<T> = Extract<keyof T, string>;

type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

type KnownDeferredCurrentColumnsGuard<
  TColumns extends QueryColumns,
  TExpr,
> = [Exclude<LiteralDeferredKeys<CurrentDepsOf<TExpr>>, keyof TColumns>] extends [never]
  ? unknown
  : {
      __teta_unknown_deferred_current_columns__: Exclude<
        LiteralDeferredKeys<CurrentDepsOf<TExpr>>,
        keyof TColumns
      >;
    };

type UnionToIntersection<T> = (
  T extends unknown ? (value: T) => void : never
) extends (value: infer TResult) => void ? TResult : never;

type KnownDeferredCurrentSelectionGuard<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = UnionToIntersection<{
  [K in keyof TSelection]: KnownDeferredCurrentColumnsGuard<TColumns, TSelection[K]>;
}[keyof TSelection]>;

type ColumnValueForKey<TColumns extends QueryColumns, TKey> =
  [TKey] extends [never]
    ? never
    : TKey extends keyof TColumns
      ? TColumns[TKey & keyof TColumns]
      : never;

type SingleLiteralKey<TDeps> = LiteralDeferredKeys<TDeps> extends infer TKey extends string
  ? [TKey] extends [never]
    ? never
    : TKey
  : never;

type CurrentDeferredExprValue<TColumns extends QueryColumns, TExpr> =
  TExpr extends ExprRef<never>
    ? ColumnValueForKey<TColumns, SingleLiteralKey<CurrentDepsOf<TExpr>>>
    : TExpr extends ExprRef<infer TValue>
      ? TValue
      : ProjectionValueResult<TExpr>;

type CurrentDeferredProjectionResult<
  TColumns extends QueryColumns,
  TSelection extends Record<string, unknown>,
> = {
  [K in keyof TSelection]: CurrentDeferredExprValue<TColumns, Exclude<TSelection[K], undefined>>;
};

type DeferredProjectionShapeInput<TSelection extends Record<string, unknown>> = {
  [K in keyof TSelection]: [NonNullable<TSelection[K]>] extends [never]
    ? never
    : NonNullable<TSelection[K]> extends ProjectionValue
      ? TSelection[K]
      : never;
};

type DefinedProjectionShape<TSelection extends Record<string, unknown>> = {
  [K in keyof TSelection]: Exclude<TSelection[K], undefined> extends ProjectionValue
    ? Exclude<TSelection[K], undefined>
    : never;
};

type ExtendResult<TColumns extends QueryColumns, TExtension extends QueryColumns> =
  Omit<TColumns, StringKeyOf<TExtension>> & TExtension;

type NonCallableSelection<TSelection> = TSelection & {
  readonly apply?: never;
  readonly bind?: never;
  readonly call?: never;
};

export function extend<const Sel extends Record<string, unknown>>(
  selection: NonCallableSelection<Sel> & DeferredProjectionShapeInput<Sel>
): <TColumns extends QueryColumns>(
  query: Query<TColumns>
    & KnownDeferredCurrentSelectionGuard<NoInfer<TColumns>, Sel>
) => Query<ExtendResult<TColumns, CurrentDeferredProjectionResult<TColumns, DefinedProjectionShape<Sel>>>>;

export function extend<TColumns extends QueryColumns, const Sel extends ProjectionShape>(
  selector: (cols: ColumnRefs<TColumns>) => Sel
): (query: Query<TColumns>) => Query<ExtendResult<TColumns, ProjectionResult<Sel>>>;

export function extend(selectorOrSelection: unknown): unknown {
  return (query: Query<QueryColumns>) => {
    if (typeof selectorOrSelection === "function") {
      return map((cols: ColumnRefs<QueryColumns>) => ({
        ...currentColumns(cols, query.columnNames),
        ...(selectorOrSelection as (cols: ColumnRefs<QueryColumns>) => ProjectionShape)(cols),
      }))(query);
    }

    return map({
      ...currentColumns(query.columns as ColumnRefs<QueryColumns>, query.columnNames),
      ...(selectorOrSelection as ProjectionShape),
    })(query);
  };
}

function currentColumns(
  cols: ColumnRefs<QueryColumns>,
  columnNames: readonly string[]
): Record<string, ColumnRef<any, string>> {
  const result: Record<string, ColumnRef<any, string>> = {};
  for (const name of columnNames) {
    result[name] = Reflect.get(cols, name) as ColumnRef<any, string>;
  }
  return result;
}
```

- [ ] **Step 2: Export `extend` through query module**

In `packages/teta/src/edsl/query.ts`, add:

```ts
export { extend } from "./query/extend.ts";
```

- [ ] **Step 3: Export `extend` from public entrypoint**

In `packages/teta/mod.ts`, add near `map`:

```ts
/** Adds or replaces columns while preserving existing query columns. */
export const extend: typeof import("./src/edsl/query.ts").extend = query.extend;
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/query/extend.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts
git commit -m "feat: add extend query helper"
```

### Task 7: Add Tests For Comparison Filter Helpers

**Files:**
- Modify: `packages/teta/tests/deferred_proxy.test.ts`
- Modify: `packages/teta/tests/typecheck.ts`

- [ ] **Step 1: Add runtime imports**

In `packages/teta/tests/deferred_proxy.test.ts`, add:

```ts
  filterEq,
  filterGte,
  mul,
```

- [ ] **Step 2: Add runtime tests**

Add these tests near the filter tests:

```ts
  test("supports filterEq with deferred expression operands", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter(eq(col("active"), true)));
    const actual = pipe(users, filterEq(col("active"), true));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterGte with computed callback operands", () => {
    const users = createUsersPipelineTable();
    const expected = pipe(users, filter((user) => gte(add(mul(user.age, 2), 1), 37)));
    const actual = pipe(users, filterGte((user) => add(mul(user.age, 2), 1), 37));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });

  test("supports filterEq with callbacks on both operands", () => {
    const users = table("users", {
      age: t.int(),
      expected_age: t.int(),
    });
    const expected = pipe(users, filter((user) => eq(user.age, user.expected_age)));
    const actual = pipe(users, filterEq((user) => user.age, (user) => user.expected_age));

    expect(toSql(actual, { dialect: "postgresql", format: "compact" })).toBe(
      toSql(expected, { dialect: "postgresql", format: "compact" })
    );
  });
```

- [ ] **Step 3: Add typecheck imports and examples**

In `packages/teta/tests/typecheck.ts`, add these imports from `../mod.ts`:

```ts
filterEq,
filterNe,
filterGt,
filterGte,
filterLt,
filterLte,
mul,
```

Add near filter examples:

```ts
const filterEqColUsers = pipe(users, filterEq(col("name"), "Ada"));
const filterGteComputedUsers = pipe(users, filterGte((user) => add(mul(user.id, 2), 1), 3));
const filterEqCallbackUsers = pipe(users, filterEq((user) => user.id, (user) => user.id));
const filterNeUsers = pipe(users, filterNe((user) => user.name, "deleted"));
const filterGtUsers = pipe(users, filterGt((user) => user.id, 0));
const filterLtUsers = pipe(users, filterLt((user) => user.id, 100));
const filterLteUsers = pipe(users, filterLte((user) => user.id, 100));
const literalStringFilter = pipe(users, filterEq("status", "active"));
```

Add type assertions:

```ts
type _FilterEqColUsersName = Expect<Equal<ExprType<typeof filterEqColUsers.columns.name>, string>>;
type _FilterGteComputedUsersId = Expect<Equal<ExprType<typeof filterGteComputedUsers.columns.id>, SqlInt>>;
type _FilterEqCallbackUsersId = Expect<Equal<ExprType<typeof filterEqCallbackUsers.columns.id>, SqlInt>>;
type _FilterNeUsersName = Expect<Equal<ExprType<typeof filterNeUsers.columns.name>, string>>;
type _FilterGtUsersId = Expect<Equal<ExprType<typeof filterGtUsers.columns.id>, SqlInt>>;
type _FilterLtUsersId = Expect<Equal<ExprType<typeof filterLtUsers.columns.id>, SqlInt>>;
type _FilterLteUsersId = Expect<Equal<ExprType<typeof filterLteUsers.columns.id>, SqlInt>>;
type _LiteralStringFilterName = Expect<Equal<ExprType<typeof literalStringFilter.columns.name>, string>>;
```

Add negative tests:

```ts
// @ts-expect-error filterEq rejects unknown deferred columns when applied to a typed query
pipe(users, filterEq(col("missing"), 1));
// @ts-expect-error filterEq callback operands must be valid expressions
pipe(users, filterEq((user) => user.name, (user) => user.id));
```

Add void references:

```ts
void filterEqColUsers;
void filterGteComputedUsers;
void filterEqCallbackUsers;
void filterNeUsers;
void filterGtUsers;
void filterLtUsers;
void filterLteUsers;
void literalStringFilter;
```

- [ ] **Step 4: Run tests to verify red state**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: FAIL because comparison filter helpers are not exported.

- [ ] **Step 5: Commit tests**

Run:

```bash
git add packages/teta/tests/deferred_proxy.test.ts packages/teta/tests/typecheck.ts
git commit -m "test: cover comparison filter helpers"
```

### Task 8: Implement Comparison Filter Helpers

**Files:**
- Create: `packages/teta/src/edsl/query/filter_comparison.ts`
- Modify: `packages/teta/src/edsl/query.ts`
- Modify: `packages/teta/mod.ts`

- [ ] **Step 1: Create `filter_comparison.ts`**

Create `packages/teta/src/edsl/query/filter_comparison.ts` with:

```ts
import { filter, Query } from "./builder.ts";
import type { QueryStep } from "./builder.ts";
import type {
  ColumnRefs,
  DeferredExprDepsOf,
  ExprInput,
  ExprRef,
} from "../expr.ts";
import { resolveDeferredExpr } from "../expr.ts";
import { eq, ne, gt, gte, lt, lte } from "../expr.ts";
import type { SqlDate, SqlNumber, SqlTimestamp } from "../sql/types.ts";

type QueryColumns = Record<string, any>;
type ComparableInput = SqlNumber | number | bigint | SqlDate | SqlTimestamp | null;
type Operand<TColumns extends QueryColumns, TValue> =
  | ExprInput<TValue>
  | ((cols: ColumnRefs<TColumns>) => ExprInput<TValue>);

type CurrentDepsOf<TExpr> = DeferredExprDepsOf<TExpr> extends { current?: infer TCurrent }
  ? TCurrent
  : Record<never, never>;

type LiteralDeferredKeys<TDeps> = Extract<{
  [K in keyof TDeps]: K extends string
    ? string extends K
      ? never
      : K
    : never;
}[keyof TDeps], string>;

type KnownDeferredCurrentColumnsGuard<
  TColumns extends QueryColumns,
  TExpr,
> = [Exclude<LiteralDeferredKeys<CurrentDepsOf<TExpr>>, keyof TColumns>] extends [never]
  ? unknown
  : {
      __teta_unknown_deferred_current_columns__: Exclude<
        LiteralDeferredKeys<CurrentDepsOf<TExpr>>,
        keyof TColumns
      >;
    };

export function filterEq<TColumns extends QueryColumns, T, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, eq);
}

export function filterNe<TColumns extends QueryColumns, T, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, ne);
}

export function filterGt<TColumns extends QueryColumns, T extends ComparableInput, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, gt);
}

export function filterGte<TColumns extends QueryColumns, T extends ComparableInput, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, gte);
}

export function filterLt<TColumns extends QueryColumns, T extends ComparableInput, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, lt);
}

export function filterLte<TColumns extends QueryColumns, T extends ComparableInput, TLeft extends Operand<TColumns, T>, TRight extends Operand<TColumns, T>>(
  left: TLeft,
  right: TRight
): (
  query: Query<TColumns> & KnownDeferredCurrentColumnsGuard<NoInfer<TColumns>, TLeft | TRight>
) => Query<TColumns> {
  return comparisonFilter(left, right, lte);
}

function comparisonFilter<TColumns extends QueryColumns, T>(
  left: Operand<TColumns, T>,
  right: Operand<TColumns, T>,
  op: (left: ExprInput<T>, right: ExprInput<T>) => ExprRef<boolean>
): QueryStep<TColumns, TColumns> {
  return (query: Query<TColumns>) => {
    const resolvedLeft = resolveOperand(query, left);
    const resolvedRight = resolveOperand(query, right);
    return filter(op(resolvedLeft, resolvedRight))(query);
  };
}

function resolveOperand<TColumns extends QueryColumns, T>(
  query: Query<TColumns>,
  operand: Operand<TColumns, T>
): ExprInput<T> {
  const value = typeof operand === "function"
    ? operand(query.columns)
    : operand;
  return value instanceof ExprRef
    ? resolveDeferredExpr(value, {
        current: {
          label: "current row",
          columns: query.columns as ColumnRefs<Record<string, any>>,
          columnNames: query.columnNames,
        },
      }) as ExprInput<T>
    : value;
}
```

- [ ] **Step 2: Export helpers through query module**

In `packages/teta/src/edsl/query.ts`, add:

```ts
export {
  filterEq,
  filterNe,
  filterGt,
  filterGte,
  filterLt,
  filterLte,
} from "./query/filter_comparison.ts";
```

- [ ] **Step 3: Export helpers from public entrypoint**

In `packages/teta/mod.ts`, add near `filter`:

```ts
/** Filters rows where two operands are equal. */
export const filterEq: typeof import("./src/edsl/query.ts").filterEq = query.filterEq;
/** Filters rows where two operands are not equal. */
export const filterNe: typeof import("./src/edsl/query.ts").filterNe = query.filterNe;
/** Filters rows where the left operand is greater than the right operand. */
export const filterGt: typeof import("./src/edsl/query.ts").filterGt = query.filterGt;
/** Filters rows where the left operand is greater than or equal to the right operand. */
export const filterGte: typeof import("./src/edsl/query.ts").filterGte = query.filterGte;
/** Filters rows where the left operand is less than the right operand. */
export const filterLt: typeof import("./src/edsl/query.ts").filterLt = query.filterLt;
/** Filters rows where the left operand is less than or equal to the right operand. */
export const filterLte: typeof import("./src/edsl/query.ts").filterLte = query.filterLte;
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
bun test packages/teta/tests/deferred_proxy.test.ts
bun run --cwd packages/teta typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add packages/teta/src/edsl/query/filter_comparison.ts packages/teta/src/edsl/query.ts packages/teta/mod.ts
git commit -m "feat: add comparison filter helpers"
```

### Task 9: Update Documentation

**Files:**
- Modify: `packages/teta/README.md`
- Modify: `doc/cheatsheet.md`
- Modify: `doc/TUTORIAL.md`
- Modify: `doc/TYPES.md`

- [ ] **Step 1: Update quick-start examples**

In `packages/teta/README.md`, add `flow`, `extend`, and `filterEq` examples after the existing quick-start pipeline:

```ts
const activePublicUsers = flow(
  filterEq(col("active"), true),
  extend((user) => ({
    normalized_email: lower(user.email),
  })),
  pick("id", "normalized_email")
);
```

Also add one sentence:

```md
Bare strings in comparison filter helpers are literals; use `col("name")` or a row callback for columns.
```

- [ ] **Step 2: Update cheatsheet**

In `doc/cheatsheet.md`, add a compact section near query composition:

```md
Use `flow(...)` to save reusable pipelines:

```ts
const activePublicUsers = flow(
  filterEq(col("active"), true),
  pick("id", "name")
);
```
```

Add `extend(...)` under projection helpers:

```ts
const enrichedUsers = pipe(users, extend((user) => ({
  name_upper: upper(user.name),
})));
```

Add variadic boolean example near expression helpers:

```ts
filter(and(eq(col("active"), true), gte(col("age"), 18), isNotNull(col("email"))))
```

- [ ] **Step 3: Update tutorial**

In `doc/TUTORIAL.md`, add a short subsection after projection shaping helpers:

```md
### Reusable pipelines and computed columns

`flow(...)` composes query steps without immediately applying them:

```ts
const publicActiveUsers = flow(
  filterEq(col("active"), true),
  extend((user) => ({ name_upper: upper(user.name) })),
  pick("id", "name_upper")
);

const q = publicActiveUsers(users);
```

Comparison filter helpers accept literals, expressions, and row callbacks on either side. Bare strings are string literals, not column names.
```

- [ ] **Step 4: Update type guide**

In `doc/TYPES.md`, add bullets where `QueryStep` is explained:

```md
- `flow(...)` composes query steps and preserves each intermediate type.
- `extend(...)` keeps existing columns and adds or replaces the extension keys.
- `filterEq(...)` and related helpers return `QueryStep<T, T>` and apply the same deferred-column checks as `filter(...)`.
```

- [ ] **Step 5: Run docs scan and full check**

Run:

```bash
rg -n "bare string|filterEq|flow\\(|extend\\(" packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
bun run check
```

Expected: `rg` finds the new docs examples, and `bun run check` passes.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add packages/teta/README.md doc/cheatsheet.md doc/TUTORIAL.md doc/TYPES.md
git commit -m "docs: show functional edsl helpers"
```

### Task 10: Final Verification

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

- [ ] **Step 4: Inspect public API exports**

Run:

```bash
rg -n "flow|extend|filterEq|filterNe|filterGt|filterGte|filterLt|filterLte" packages/teta/mod.ts packages/teta/src/edsl/query.ts packages/teta/src/edsl/pipe.ts
```

Expected: all new helpers are exported from the public entrypoint and source modules.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean worktree after all planned commits.
