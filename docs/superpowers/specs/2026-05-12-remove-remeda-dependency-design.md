# Remove Remeda Dependency Design

## Goal

Fully remove `remeda` from Teta. Users should be able to build query pipelines and common column projections using only `@teta/teta`, and the package should no longer depend on `remeda` internally.

## Public API

Add and export a Teta-owned `pipe` helper:

```ts
const q = pipe(
  users,
  filter((user) => eq(user.active, true)),
  pickCols("id", "name"),
);
```

`pipe(value, ...steps)` applies unary steps from left to right. It is intentionally small and only promises the behavior Teta examples need: feed one value through functions that each accept the previous result.

Keep `pickCols(...names)` as a row projection helper for existing `map(pickCols(...))` usage, and extend it to also work as a direct query step:

```ts
pipe(users, pickCols("id", "name"))
pipe(users, map(pickCols("id", "name")))
```

Add `mapCols(rename)` as the column-key rename counterpart to `pickCols`. It should preserve each selected value and change every output key through the callback:

```ts
pipe(users, mapCols((key) => `user_${key}`))
pipe(users, map(mapCols((key) => `user_${key}`)))
```

Template-literal rename callbacks should infer exact output keys when TypeScript can see the literal relationship. Widened `string` callbacks may produce widened keys, and should not make arbitrary renamed properties appear typed as known fields.

## Internal Architecture

Remove the import of `purry` from `packages/teta/src/edsl/query/builder.ts`. Query helpers are already public curried-only APIs, so their runtime implementations can return closures explicitly instead of delegating to Remeda currying.

`pipe` should live in a small local utility module under `packages/teta/src/edsl`, or another existing public-API-adjacent location that matches repo style. `mod.ts` should re-export it with an explicit public declaration.

`pickCols` and `mapCols` need to bridge two uses:

- Row selector use, where they receive `ColumnRefs<TColumns>` and return a projection object.
- Query-step use, where they receive a `Query<TColumns>` through `pipe` and return `map(selector)(query)`.

The implementation should use existing query and expression primitives instead of creating a parallel projection system.

## Dependency Cleanup

Remove `remeda` from:

- root `package.json`
- `packages/teta/package.json`
- `bun.lock`
- `deno.lock` if no remaining Deno/npm reference needs it

After source and docs migration, `rg "from \"remeda\"|from 'remeda'|npm:remeda|\\bremeda\\b"` should find only historical design or plan documents, if those are intentionally left unchanged.

## Docs And Examples

Update examples and active docs to import `pipe` from `@teta/teta` instead of `remeda`.

Replace Remeda object utility examples:

- `pick(...)` becomes `pickCols(...)`
- `mapKeys(...)` becomes `mapCols(...)`
- nested `pipe(user, pick(...), mapKeys(...))` examples become direct query-step examples where possible

Existing historical superpowers specs and plans do not need migration unless they are part of active package documentation.

## Error Handling

`pickCols` should keep the existing runtime unknown-column error when a requested column is missing.

`mapCols` should reject invalid projection inputs in the same way existing projection resolution rejects invalid `map` selections. It does not need a new user-facing error code unless implementation exposes a distinct invalid state.

## Testing

Add tests before implementation for:

- `pipe` applies multiple query steps in order.
- direct `pickCols("id", "name")` produces the same SQL/output columns as `map(pickCols("id", "name"))`.
- direct `mapCols((key) => \`user_${key}\`)` renames all columns.
- row-selector `map(mapCols(...))` remains valid.
- typecheck coverage proves exact renamed template keys, selected column value types, and rejection of unknown renamed keys.

Update existing tests and typecheck fixtures to import all replacements from Teta.

## Non-Goals

Do not add general-purpose Remeda clones such as generic `pick`, `omit`, `merge`, or `mapKeys`. Teta should expose query and column helpers, not become a general object utility package.

Do not reintroduce data-first query helper APIs. The replacement should preserve the current curried query-step style.
