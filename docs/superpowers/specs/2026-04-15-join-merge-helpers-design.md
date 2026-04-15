# Join Merge Helpers Design

Date: 2026-04-15
Status: Approved for planning

## Summary

Keep `join(...)` as the primitive query combinator, but make joined output shapes strict by default. When left and right queries expose overlapping column names, joining without an explicit merge strategy becomes an error. Add a small set of typed merge helpers and equi-join predicate helpers so common joins remain concise, especially in pipeline-first form.

## Goals

- Make overlapping join output names explicit instead of silently letting one side win.
- Provide convenient merge helpers for the common conflict-resolution cases.
- Provide concise helpers for common equi-join predicates.
- Make the curried, pipeline-first join form the documented and preferred style.
- Preserve custom join merger callbacks for users who need a fully custom output shape.

## Non-Goals

- Replacing `join(...)` with a new relation DSL or comprehension syntax in this change.
- Removing the existing data-first join overloads immediately.
- Adding every possible alias spelling for merge helpers in the first version.
- Inferring join predicates from schema metadata or foreign keys.
- Changing SQL lowering semantics for inner, left, right, full, or lateral joins.

## Current Behavior

Today Teta treats `join(...)` as the primitive and implements `innerJoin(...)`, `leftJoin(...)`, `rightJoin(...)`, and `fullJoin(...)` as thin wrappers that set the join type. The curried form already exists, but the public API and overload set still give equal weight to data-first and curried calling styles.

Joined output columns are currently resolved by the default merger in `packages/teta/src/edsl/query/join.ts`, which behaves like `{ ...left, ...right }`. When the left and right queries share column names, the right side silently overwrites the left side in the inferred output shape.

This default is convenient for short examples, but it hides collisions, makes refactors risky, and forces users to drop into handwritten merger callbacks when they want predictable renaming behavior.

## Proposed Change

### 1. Strict default overlap handling

If a join is called without a merge strategy and the left and right output names overlap, the join becomes invalid.

Type-level behavior:

- joins with no overlapping output names continue to infer the merged shape automatically
- joins with overlapping output names and no merge strategy produce a type error

Runtime behavior:

- if untyped or `any`-typed code bypasses the type system, the same case throws a stable user-facing error
- the error message should list the overlapping keys and suggest adding an explicit merge helper

This applies to:

- `join(...)`
- `innerJoin(...)`
- `leftJoin(...)`
- `rightJoin(...)`
- `fullJoin(...)`

### 2. Merge helpers as reusable merger functions

Add a small helper family that returns join merger callbacks.

Initial public helpers:

- `prefixOverlapLeft(prefix)`
- `prefixOverlapRight(prefix)`
- `prefixAllLeft(prefix)`
- `prefixAllRight(prefix)`
- `suffixAllLeft(suffix)`
- `suffixAllRight(suffix)`
- `dropOverlapLeft()`
- `dropOverlapRight()`

Semantics:

- `prefixOverlapLeft(prefix)`
  - rename only the left-side keys that overlap with right-side keys
  - keep non-overlapping left keys unchanged
  - if the renamed keys still overlap with right keys, produce a type error and runtime error
- `prefixOverlapRight(prefix)`
  - symmetric to `prefixOverlapLeft(prefix)`
- `prefixAllLeft(prefix)`
  - rename all left-side keys
  - if renamed left keys still overlap with right keys, produce a type error and runtime error
- `prefixAllRight(prefix)`
  - symmetric to `prefixAllLeft(prefix)`
- `suffixAllLeft(suffix)`
  - rename all left-side keys with a suffix
  - if renamed left keys still overlap with right keys, produce a type error and runtime error
- `suffixAllRight(suffix)`
  - symmetric to `suffixAllLeft(suffix)`
- `dropOverlapLeft()`
  - drop only the left-side keys that overlap with the right-side keys
  - keep all non-overlapping left keys and all right keys
- `dropOverlapRight()`
  - symmetric to `dropOverlapLeft()`

These helpers are the new convenience layer. Fully custom merger callbacks remain supported:

```ts
pipe(
  users,
  join(orders, usingCols("id"), (user, order) => ({
    user_id: user.id,
    order_total: order.total,
  }))
)
```

The strict overlap rule applies only when no merge strategy is supplied.

### 3. Predicate helpers for common equi-joins

Add concise helpers that build the existing `(left, right) => ExprRef<boolean>` predicate shape.

Initial public helpers:

- `usingCols(name)`
- `usingCols(names)`
- `onEq(mapping)`

Semantics:

- `usingCols("id")`
  - equivalent to `(left, right) => eq(left.id, right.id)`
- `usingCols(["tenant_id", "user_id"])`
  - equivalent to an `AND` of equality predicates for each shared name
- `onEq({ id: "user_id" })`
  - equivalent to `(left, right) => eq(left.id, right.user_id)`
- `onEq({ tenant_id: "tenant_id", id: "user_id" })`
  - equivalent to an `AND` of equality predicates for each left-to-right mapping

These are helpers, not replacements for arbitrary predicates. The existing callback form remains the escape hatch for non-equality joins or mixed predicates.

### 4. Pipeline-first becomes the canonical style

The curried form is already supported and should become the documented default:

```ts
pipe(
  users,
  join(orders, usingCols("id"), prefixOverlapLeft("user_"))
)
```

Fixed join helpers follow the same style:

```ts
pipe(
  users,
  leftJoin(orders, onEq({ id: "user_id" }), dropOverlapLeft())
)
```

The data-first overloads remain for compatibility:

```ts
join(users, orders, usingCols("id"), prefixOverlapLeft("user_"))
```

This design does not remove data-first joins, but new docs and examples should prefer the curried form consistently.

## Detailed API Shape

### Merge helpers

Representative signatures:

```ts
function prefixOverlapLeft<const TPrefix extends string>(
  prefix: TPrefix
): JoinColumnMerger<unknown, unknown, unknown>;

function prefixAllLeft<const TPrefix extends string>(
  prefix: TPrefix
): JoinColumnMerger<unknown, unknown, unknown>;

function suffixAllLeft<const TSuffix extends string>(
  suffix: TSuffix
): JoinColumnMerger<unknown, unknown, unknown>;

function dropOverlapLeft(): JoinColumnMerger<unknown, unknown, unknown>;
```

The public signatures should preserve literal prefix and suffix strings so the type system can evaluate renamed output keys precisely.

The exact return types should not expose `unknown` in the final public API. Internally these helpers should evaluate:

- overlap keys
- renamed key sets
- whether the final key set is collision-free
- the resulting output column map

### Predicate helpers

Representative signatures:

```ts
function usingCols<const TName extends string>(
  name: TName
): <TLeft extends Record<TName, any>, TRight extends Record<TName, any>>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean>;

function usingCols<const TNames extends readonly string[]>(
  names: TNames
): <TLeft extends Record<TNames[number], any>, TRight extends Record<TNames[number], any>>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean>;

function onEq<const TMapping extends Record<string, string>>(
  mapping: TMapping
): <TLeft extends Record<keyof TMapping, any>, TRight extends Record<TMapping[keyof TMapping], any>>(
  left: ColumnRefs<TLeft>,
  right: ColumnRefs<TRight>
) => ExprRef<boolean>;
```

These helpers should preserve literal keys so invalid column names fail at compile time where possible.

## Type System Strategy

The design depends on type-level overlap detection and key transformation.

Required type capabilities:

- compute overlapping keys between left and right column maps
- reject the no-merge case when overlap is non-empty
- rename a subset or all keys on one side using a literal prefix or suffix
- drop only overlapping keys on one side
- verify that the transformed final key set is collision-free
- preserve left/right outer-join nullability through merge helper output shapes

Examples:

- `leftJoin(orders, usingCols("id"))`
  - type error if both sides expose `id` and no merge helper is given
- `leftJoin(orders, usingCols("id"), dropOverlapLeft())`
  - valid, output keeps the right-side `id`
- `leftJoin(orders, usingCols("id"), prefixOverlapLeft("user_"))`
  - valid if `user_id` does not already collide with another right-side key
- `leftJoin(orders, usingCols("id"), prefixOverlapLeft("order_"))`
  - type error if renaming `id -> order_id` still collides with an existing right-side `order_id`

## Runtime Error Handling

Add stable runtime errors that mirror the compile-time rules.

Suggested error cases:

- `JOIN_OVERLAPPING_COLUMNS`
  - thrown when no merge strategy is provided and left/right output names overlap
- `JOIN_MERGE_CONFLICT`
  - thrown when a merge helper or custom merger resolves to overlapping output names at runtime

The runtime error messages should include the conflicting keys and point users toward the new merge helpers.

## Migration Story

This is a breaking behavior change for joins that currently rely on silent right-side overwrite semantics.

Migration guidance:

- if the current behavior was intentional, replace the omitted merger with `dropOverlapLeft()`
- if users want explicit renamed left-side keys, use `prefixOverlapLeft(...)` or `prefixAllLeft(...)`
- if users want explicit renamed right-side keys, use the symmetric right-side helpers
- if users want a bespoke output shape, keep using a custom merger callback

This makes the old implicit behavior explicit and searchable in user code.

## Documentation Strategy

Update the join docs to make the curried style primary and to document the new strictness.

Required doc updates:

- `doc/TUTORIAL.md`
- `doc/TYPES.md`
- `doc/cheatsheet.md`

Documentation changes:

- prefer `pipe(left, join(right, on, merge?))` examples
- explain that overlapping output names now require an explicit merge strategy
- document the new merge helpers and when to use each one
- document `usingCols(...)` and `onEq(...)` as shorthand for common equi-join predicates
- show `dropOverlapLeft()` as the migration path for the old implicit overwrite behavior

## Testing Strategy

Add tests before implementation.

Type-level tests:

- overlapping default join fails without a merge strategy
- non-overlapping default join still works
- `dropOverlapLeft()` preserves the right-side overlapping key and non-overlapping left keys
- prefix and suffix helpers rename keys as expected
- prefix and suffix helpers fail when the renamed keys still collide
- `usingCols(...)` and `onEq(...)` reject invalid column names
- outer-join nullability remains correct after merge helper application

Runtime tests:

- the no-merge overlap case throws `JOIN_OVERLAPPING_COLUMNS`
- merge helpers that still collide throw `JOIN_MERGE_CONFLICT`
- `usingCols(...)` renders the same SQL as handwritten equality predicates
- `onEq(...)` renders the same SQL as handwritten mapped equality predicates
- curried and data-first forms behave the same
- fixed join helpers inherit the same overlap and helper behavior

## Risks And Mitigations

### Risk: the breaking default surprises existing users

Mitigation:

- document the change prominently
- provide `dropOverlapLeft()` as the direct migration helper for the previous implicit behavior
- mirror compile-time failures with stable runtime errors

### Risk: type-level key rewriting becomes too complex or fragile

Mitigation:

- start with a small helper set instead of a large alias family
- preserve literal prefix and suffix types only where needed
- keep custom merger callbacks as the escape hatch

### Risk: helper naming expands too quickly

Mitigation:

- ship only the core semantic set in this change
- defer aliases like `prefixLeft(...)`, `suffixRight(...)`, `keepRight(...)`, or `preferRight(...)` until real usage justifies them

### Risk: helper-based predicates obscure that arbitrary predicates are still available

Mitigation:

- position `usingCols(...)` and `onEq(...)` as convenience helpers only
- keep examples showing the direct callback form for more complex predicates

## Implementation Notes

- Update join type logic in `packages/teta/src/edsl/query/join.ts` so the default path rejects overlapping output names instead of silently overwriting them.
- Extend the public query API surface in `packages/teta/src/edsl/query.ts` and `packages/teta/mod.ts` to export the new merge and predicate helpers.
- Update join overload typing in `packages/teta/src/edsl/query/builder.ts` so the no-merge path fails on overlapping names and helper-based mergers carry their transformed output shapes.
- Add typecheck coverage in `packages/teta/tests/typecheck.ts`.
- Add runtime error coverage in `packages/teta/tests/errors.test.ts`.
- Add SQL rendering coverage in `packages/teta/tests/query.test.ts` and any focused join test files that best fit the existing suite.
