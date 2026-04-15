# Cast Helpers Design

Date: 2026-04-15
Status: Approved for planning

## Summary

Keep `cast(value, target)` as the primitive casting escape hatch, and add a small curated set of named wrappers for the most common target types. The first pass adds `toString(...)` and `toTimestamp(...)` alongside the existing `toInt(...)`, `toFloat(...)`, and `toDate(...)`.

## Goals

- Make common casts shorter to write in the expression DSL.
- Preserve the current `cast(...)` API for uncommon or dialect-specific targets.
- Keep the wrapper layer small and unsurprising in the first pass.
- Preserve nullability through the wrapper return types.

## Non-Goals

- Replacing `cast(...)` with a new cast namespace or builder DSL.
- Inferring SQL target tokens from TypeScript generic arguments.
- Adding wrappers for every possible SQL scalar type in this change.
- Changing renderer, planner, or AST behavior for casts.
- Making string-to-timestamp parsing implicit.

## Current Behavior

Today Teta exposes the primitive helper:

```ts
cast<TTarget>(value, target)
```

This is flexible, but verbose for the common cases. Teta already provides a few thin named wrappers:

- `toInt(...)`
- `toFloat(...)`
- `toDate(...)`

These wrappers are implemented as typed aliases over `cast(...)`, not as distinct AST nodes or lowering rules.

## Proposed Change

### 1. Keep `cast(...)` as the primitive

`cast(value, target)` remains the lowest-level public cast API. It continues to accept arbitrary target strings so users can still express dialect-specific casts such as `"TEXT"` or `"STRING"` when needed.

The new helpers are convenience APIs, not a replacement for `cast(...)`.

### 2. Add a small curated wrapper set

Add two new helpers:

- `toString(...)`
- `toTimestamp(...)`

After this change, the small named cast family becomes:

- `toInt(...)`
- `toFloat(...)`
- `toDate(...)`
- `toString(...)`
- `toTimestamp(...)`

This keeps the surface area focused while covering the most common scalar targets users are likely to reach for during query construction.

### 3. Exact lowering behavior

The new helpers are thin wrappers over `cast(...)`.

Semantics:

- `toString(value)` lowers to `cast(value, "VARCHAR")`
- `toTimestamp(value)` lowers to `cast(value, "TIMESTAMP")`

`VARCHAR` is the default token for `toString(...)` because it is the more standard portable string cast target. If a user specifically wants `"TEXT"` or another dialect-oriented token, they should continue to call `cast(...)` directly.

### 4. Input and typing rules

#### `toString(...)`

`toString(...)` should be broad and convenience-oriented:

- accept the same broad expression inputs that `cast(...)` accepts in practice
- preserve nullability in the result type
- return `ExprRef<PropagateNull<TValue, string>>`

This helper is meant to reduce boilerplate, not impose a narrow source-type policy.

#### `toTimestamp(...)`

`toTimestamp(...)` should be narrower:

- accept typed temporal values, not arbitrary strings
- preserve nullability in the result type
- return `ExprRef<PropagateNull<TValue, SqlTimestamp>>`

First-pass accepted inputs:

- `SqlDate`
- `SqlTimestamp`
- `null`

This keeps the helper aligned with explicit temporal casting rather than string parsing.

### 5. Keep parsing explicit

String-to-timestamp conversion should continue to go through `dateParse(value, format)`.

This is an intentional boundary:

- `toTimestamp(...)` is for casting already-temporal values
- `dateParse(...)` is for parsing strings using an explicit format

The first pass should not blur these responsibilities by allowing arbitrary strings into `toTimestamp(...)`.

## API Shape

Representative signatures:

```ts
function toString<TValue>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, string>>;

function toTimestamp<TValue extends SqlDate | SqlTimestamp | null>(
  value: ExprInput<TValue>
): ExprRef<PropagateNull<TValue, SqlTimestamp>>;
```

These helpers should remain direct wrappers so their implementation stays obvious and the generated SQL stays predictable.

## Placement and Exports

- Add `toString(...)` in `packages/teta/src/edsl/sql/expr/ops/math.ts` next to `toInt(...)` and `toFloat(...)`
- Add `toTimestamp(...)` in `packages/teta/src/edsl/sql/expr/ops/date.ts` next to `toDate(...)`
- Re-export both helpers through the existing expression barrels
- Expose both helpers from the top-level `packages/teta/mod.ts` API

No new module structure is needed.

## Testing Strategy

Test at the public expression and query level, not at renderer internals.

Add coverage for:

- `toString(...)` rendering and execution behavior in the scalar helper suite
- `toTimestamp(...)` rendering and execution behavior in the scalar helper suite
- nullability-preserving behavior consistent with the existing cast wrappers

Do not add tests that treat `toTimestamp(...)` as a parsing helper. String parsing coverage should remain with `dateParse(...)`.

## Implementation Notes

- No new AST node is required
- No planner changes are required
- No renderer changes are required
- The implementation should follow the same style as the existing named cast wrappers

## Example

```ts
map(events, ({ created_at, amount }) => ({
  created_at_ts: toTimestamp(created_at),
  amount_txt: toString(amount),
}))
```

For uncommon targets, users still fall back to the primitive:

```ts
cast(value, "TEXT")
```
