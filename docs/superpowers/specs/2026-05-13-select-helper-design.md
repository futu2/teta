# Select Helper Design

## Goal

Add a top-level `select(...)` query helper for list-style projections, plus a curried `alias(...)` helper that names projection outputs inside `select(...)`.

The design should preserve Teta's function-first style and avoid reopening the removed array syntax in `map(...)`.

## Public API

Add a new query helper:

```ts
pipe(users, select((u) => [u.id, u.name]))
pipe(users, select([$.id, $.name]))
```

Add a curried alias helper intended for `select(...)` output items:

```ts
pipe(users, select((u) => [
  pipe(u.id, alias("old_id")),
  pipe(add(u.age, 1), alias("next_age")),
]))
```

`alias(...)` is select-only. It is not intended as a general-purpose expression helper outside projection list selection.

## Supported Forms

`select(...)` should support both public selector styles:

```ts
select((u) => [u.id, u.name])
select([$.id, $.name])
select([pipe($.id, alias("old_id"))])
```

Callback form gives normal row callback ergonomics.

Deferred-array form gives parity with other deferred top-level helpers and works with `$` / `col(...)`.

## Naming Rules

Each `select(...)` item resolves to one output column name.

### Unchanged Column Refs

If an item is a plain unchanged column reference, keep its original column name:

```ts
select((u) => [u.id, u.name])   // -> { id, name }
select([$.id, $.name])          // -> { id, name }
```

This rule applies only to direct column references that are passed through unchanged.

### Explicit Aliases

If an item is wrapped with `alias("name")`, use that output name:

```ts
select((u) => [pipe(u.id, alias("old_id"))])   // -> { old_id }
```

### Generated Names

Any other unaliased expression receives an auto-generated output name:

```ts
select((u) => [u.id, add(u.age, 1), u.name, add(u.age, 2)])
```

Result keys:

```ts
{ id, col_1, name, col_2 }
```

Generated names count only unnamed computed expressions. They do not use absolute position across the whole list.

## Duplicate Output Names

Duplicate output names are rejected as a user error.

Examples that should fail:

```ts
select((u) => [u.id, pipe(u.id, alias("id"))])
select((u) => [pipe(u.id, alias("x")), pipe(u.name, alias("x"))])
select((u) => [u.id, u.id])
```

The API should not auto-rename or silently overwrite earlier outputs.

## Type Behavior

`select(...)` should return a `QueryStep<TInput, TResult>` where `TResult` is an object shape derived from the output names and item value types.

Examples:

```ts
const q1 = pipe(users, select((u) => [u.id, u.name]));
// columns: { id: ..., name: ... }

const q2 = pipe(users, select((u) => [pipe(u.id, alias("old_id"))]));
// columns: { old_id: ... }

const q3 = pipe(users, select((u) => [add(u.age, 1)]));
// columns: { col_1: ... }
```

Callback and deferred-array forms should infer the same output keys when equivalent expressions are used.

Unknown deferred current columns in deferred-array form should be rejected with the same type guard and runtime behavior as existing deferred projection helpers.

Invalid deferred left/right scope refs in current-row `select(...)` should also be rejected, matching `map(...)`, `extend(...)`, and comparison filter helpers.

## Alias Helper Behavior

`alias("name")` should be curried so it works naturally with `pipe(...)`:

```ts
pipe(expr, alias("name"))
```

Internally it should carry both:

- the wrapped expression
- the requested output name

It is select-only. If used outside `select(...)`, it should fail clearly rather than pretending to be a normal expression transform.

## Internal Architecture

Do not restore array syntax to `map(...)`.

Instead:

1. Add a dedicated `select(...)` helper.
2. Add a dedicated list-projection resolver beside existing object-projection resolution.
3. Reuse the same projected query stage-building path already used by `map(...)` once list items have been normalized into:
   - output keys
   - projection items

This keeps SQL generation and stage behavior aligned with existing projection semantics instead of creating a second projection execution path.

`alias(...)` should likely be represented as a small wrapper type or tagged marker consumed by the `select(...)` resolver.

## Error Handling

Runtime errors should cover:

- duplicate output names
- invalid deferred current/left/right scope usage
- invalid `alias(...)` names if blank
- invalid use of `alias(...)` outside `select(...)` if it reaches runtime

The errors should be user-facing and follow existing query helper error style.

## Testing

Add runtime tests for:

- callback `select((u) => [u.id, u.name])`
- deferred `select([$.id, $.name])`
- aliasing with `pipe(expr, alias("name"))`
- generated names for unnamed computed expressions
- unchanged column refs keeping original names
- duplicate-name rejection
- deferred current-column resolution
- rejection of join-side deferred refs in current-row `select(...)`

Add type tests for:

- inferred keys for plain column selections
- inferred keys for aliased items
- inferred keys for generated `col_1`, `col_2` outputs
- deferred-array type inference
- rejection of unknown deferred current columns
- rejection of invalid left/right deferred scope usage

## Non-Goals

Do not change `map(...)` back to array syntax.

Do not make `alias(...)` a general-purpose expression helper.

Do not add SQL-style `as(...)` naming syntax in this change.

Do not change `pick(...)`, `drop(...)`, or existing object-shape projection semantics.
