# Top-Level Projection Helpers Design

## Goal

Make projection reshaping helpers read as query pipeline stages, not row selector utilities. `pick(...)`, `drop(...)`, and `rename(...)` should be used only as top-level `pipe(...)` steps.

## Public API

`pick(...)` keeps selected columns:

```ts
const publicUsers = pipe(users, pick("id", "name"));
```

`drop(...)` removes selected columns and keeps all other columns in their current order:

```ts
const publicUsers = pipe(users, drop("created_at", "internal_note"));
```

`rename(...)` renames every current column through a key mapper:

```ts
const namespacedUsers = pipe(users, rename((key) => `user_${key}`));
```

These helpers are query steps only. They should not be valid row selectors:

```ts
map(pick("id", "name"));      // invalid
map(drop("created_at"));      // invalid
map(rename((key) => key));    // invalid
```

`caseWhen(...)` and `when(...)` remain unchanged.

## Behavior

`pick(...)` should reject unknown selected columns at type level when applied to a typed query, and with the existing `DEFERRED_COLUMN_UNKNOWN` user error at runtime.

`drop(...)` should reject unknown dropped columns at type level when applied to a typed query, and with the same `DEFERRED_COLUMN_UNKNOWN` user error at runtime.

`rename(...)` should preserve current runtime behavior: all columns are projected under renamed keys. Template literal rename callbacks such as `(key) => `user_${key}`` should keep exact renamed keys when TypeScript can infer the relationship.

## Internal Architecture

Move projection helpers away from row selector compatibility. The helper functions should return branded query-step functions that accept `Query<TColumns>` and return `Query<TNextColumns>`.

Direct helper execution should delegate to existing `map(...)` internally so projection lowering, validation, and SQL generation stay consistent with normal maps.

The implementation should keep the helper logic in `packages/teta/src/edsl/query/projection_helpers.ts` and continue exporting through `packages/teta/src/edsl/query.ts` and `packages/teta/mod.ts`.

## Documentation

Update docs and examples so projection helpers are shown only as top-level pipeline steps:

```ts
pipe(users, pick("id", "name"))
pipe(users, drop("created_at"))
pipe(users, rename((key) => `user_${key}`))
```

Remove examples using `map(pick(...))` or `map(rename(...))`.

## Testing

Add typecheck coverage that:

- `pipe(users, pick("id"))` narrows output keys.
- `pipe(users, drop("name"))` removes output keys.
- `pipe(users, rename((key) => `user_${key}`))` exposes renamed keys.
- `map(pick("id"))`, `map(drop("name"))`, and `map(rename(...))` are compile-time errors.
- unknown names in `pick(...)` and `drop(...)` are compile-time errors when applied to typed queries.

Add runtime coverage that:

- `pick(...)` as a query step renders the same SQL as an equivalent explicit `map`.
- `drop(...)` as a query step renders the same SQL as an equivalent explicit `map`.
- `rename(...)` as a query step renders the same SQL as an equivalent explicit `map`.
- unknown names in `pick(...)` and `drop(...)` throw `DEFERRED_COLUMN_UNKNOWN`.

## Non-Goals

Do not redesign `caseWhen(...)` or `when(...)`.

Do not support row-selector forms of `pick(...)`, `drop(...)`, or `rename(...)`.
