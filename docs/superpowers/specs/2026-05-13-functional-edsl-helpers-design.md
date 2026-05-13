# Functional EDSL Helpers Design

## Goal

Make common query and expression composition more ergonomic while keeping Teta's EDSL function-first. The new helpers should reduce repetitive `pipe(...)`, `map(...)`, `filter(...)`, and nested boolean boilerplate without introducing method chains or magic bare-string column names.

## Public API

Add `flow(...)` for reusable function composition:

```ts
const activePublicUsers = flow(
  filter((user) => eq(user.active, true)),
  pick("id", "name"),
  sort((user) => asc(user.name)),
  take(10)
);

const query = activePublicUsers(users);
```

`flow(step1, step2, ...)` should return a unary function that applies its steps left-to-right. Its type behavior should mirror `pipe(value, step1, step2, ...)` without the initial value.

Add `extend(...)` for computed columns while preserving existing columns:

```ts
const enrichedUsers = pipe(
  users,
  extend((user) => ({
    normalized_name: upper(replace(user.name, " ", "_")),
  }))
);
```

`extend(...)` should support callback selectors and deferred object selections, matching the two public `map(...)` selector forms:

```ts
extend((user) => ({ age_plus_one: add(user.age, 1) }))
extend({ active_label: caseWhen([when($.active, "active")], "inactive") })
```

The output shape is the input query columns plus the extension shape. If an extension key already exists, the extension value replaces the existing column type.

Make `and(...)` and `or(...)` variadic:

```ts
filter(and(
  eq(col("active"), true),
  gte(col("age"), 18),
  isNotNull(col("email"))
))
```

Existing binary calls should continue to work. One-argument calls should return that expression. Zero-argument calls should be rejected at type level where possible and at runtime with a user-facing error.

Add comparison filter query-step helpers:

```ts
pipe(users, filterEq(col("status"), "active"))
pipe(users, filterGte((user) => user.age, 18))
pipe(users, filterEq((user) => add(mul(user.age, 2), 1), 66))
pipe(users, filterEq((user) => user.age, (user) => user.expected_age))
```

The initial helper family should be:

```ts
filterEq(left, right)
filterNe(left, right)
filterGt(left, right)
filterGte(left, right)
filterLt(left, right)
filterLte(left, right)
```

Each helper should be equivalent to `filter((row) => op(resolve(left, row), resolve(right, row)))`, where `op` is the matching expression comparison helper.

## Operand Rules

Filter comparison operands must be symmetric. Both left and right operands support the same input model:

- literals such as `66`, `"active"`, `true`, or `null`
- expression values such as `col("age")`, `$.age`, or `add(col("age"), 1)`
- row callbacks such as `(user) => user.age` or `(user) => add(user.age, 1)`

Bare strings are always string literals, not column names. Column references must use `col("name")`, `$`, or a row callback:

```ts
filterEq("status", "active")          // literal string equals literal string
filterEq(col("status"), "active")     // column equals literal string
filterEq((user) => user.status, "active")
```

This avoids ambiguity between string literals and column names.

## Behavior

`flow(...)` should be a general utility, not query-specific. It should compose any unary functions and preserve type inference across each step.

`extend(...)` should delegate to existing `map(...)`/projection resolution logic so generated SQL follows normal map behavior. Runtime validation and deferred-column validation should match `map(...)`.

Variadic `and(...)` and `or(...)` should build the same expression tree semantics as nested binary calls. They should not change boolean normalization or SQL pushdown behavior.

Comparison filter helpers should reuse existing `filter(...)` and comparison expression helpers internally. Unknown deferred columns should be rejected with the same type guards and runtime user errors as `filter(...)`.

## Internal Architecture

Place `flow(...)` next to `pipe(...)` in `packages/teta/src/edsl/pipe.ts` and export it through `packages/teta/mod.ts`.

Implement `extend(...)` in a focused query helper module exported through `packages/teta/src/edsl/query.ts`. It should return a `QueryStep<TInput, Omit<TInput, keyof TExtension> & TExtension>` so overlapping keys use the extension value type.

Update comparison helpers in `packages/teta/src/edsl/sql/expr/ops/comparison.ts` to support variadic boolean helpers and add query filter helper wrappers in the query EDSL. If the operand resolution types become large, isolate them in a small query helper module instead of expanding `builder.ts` further.

## Documentation

Update README, tutorial, cheatsheet, and type guide with examples for:

- composing reusable pipelines with `flow(...)`
- adding computed columns with `extend(...)`
- variadic `and(...)` and `or(...)`
- comparison filter helpers using `col(...)` and row callbacks

Docs should explicitly state that bare strings in filter comparison helpers are literals, not column references.

## Testing

Add runtime tests for:

- `flow(...)` composing ordinary functions and query steps
- `extend(...)` matching equivalent explicit `map(...)` SQL
- `extend(...)` replacing an existing column key
- variadic `and(...)`/`or(...)` matching equivalent nested expressions
- `filterEq(...)` and at least one ordering helper matching equivalent explicit `filter(...)`
- comparison helpers with callback operands on both sides

Add type tests for:

- `flow(...)` preserving step-by-step input and output types
- `extend(...)` preserving existing columns and adding computed columns
- `extend(...)` replacement key type behavior
- `filterEq(col("name"), "value")` validating deferred current columns in query context
- `filterEq((row) => row.a, (row) => row.b)` validating callback operand types
- bare string operands being treated as literals, not as typed column references

## Non-Goals

Do not add method-call APIs.

Do not add bare-string column shorthand to comparison filter helpers.

Do not redesign `caseWhen(...)` or `when(...)`.

Do not add `where(...)` aliases unless a separate design explicitly chooses SQL vocabulary.
