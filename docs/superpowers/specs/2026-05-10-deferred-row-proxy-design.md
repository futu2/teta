# Deferred Row Proxy API

## Context

Teta currently uses callback selectors for most row-dependent query operations:

```ts
filter((user) => and(eq(user.active, true), gte(user.age, 18)))
map((user) => ({ id: user.id, email: user.email }))
sort((user) => asc(user.email))
leftJoin(orders, (user, order) => eq(user.id, order.user_id))
```

The callback form is strongly typed and should remain the canonical strict option, but it is verbose when the callback only exists to access columns. The new API should let users write compact column references without removing or weakening the existing callback API.

## Goals

- Add a concise no-callback form for common column access patterns.
- Support filters, projections, folds, sorts, unnest selectors, and join predicates.
- Keep the existing callback API fully supported and source compatible.
- Let existing expression helpers compose with the new shorthand.
- Provide clear runtime errors when a deferred reference cannot resolve against the current query columns.
- Preserve strong inference where practical, especially for projection helpers such as `pickCols(...)`.

## Non-Goals

- Do not replace callback selectors.
- Do not require users to opt into a new query builder style.
- Do not add one helper variant for every expression operation, such as `eqCol`, `gteCol`, `sumCol`, or `ascCol`.
- Do not attempt to make global `$` property access fully row-type-aware. The callback API remains the strictest compile-time option.

## Public API

Add deferred row proxies:

```ts
import { $, $left, $right, pickCols } from "@teta/teta";
```

The single-input proxy `$` is used with the current query row:

```ts
pipe(
  users,
  filter(and(eq($.active, true), gte($.age, 18))),
  map({
    id: $.id,
    email: $.email,
  }),
  sort(asc($.email)),
  take(10)
);
```

`$left` and `$right` are used in join predicates and join merge shapes:

```ts
pipe(
  users,
  leftJoin(orders, eq($left.id, $right.user_id)),
  map({
    id: $.id,
    email: $.email,
    total: $.total,
  })
);
```

`pickCols(...)` covers same-name projections:

```ts
const compact = map(users, pickCols("id", "email"));
```

The helper can also be used data-last:

```ts
const compact = pipe(users, map(pickCols("id", "email")));
```

Aggregates use the same expression helpers:

```ts
const spend = pipe(
  orders,
  fold({
    user_id: group($.user_id),
    order_count: count($.order_id),
    total_spend: sum($.total),
  })
);
```

## API Shape

Expression helpers accept either immediate expression inputs or deferred expression inputs. This allows existing helpers such as `eq`, `gt`, `upper`, `sum`, `group`, `asc`, and `desc` to work without new column-specific variants.

Query helpers gain overloads for deferred values:

- `filter(predicateExpr)` in addition to `filter((cols) => predicateExpr)`
- `map(selectionShape)` in addition to `map((cols) => selectionShape)`
- `fold(selectionShape)` in addition to `fold((cols) => selectionShape)`
- `sort(orderItemOrItems)` in addition to `sort((cols) => orderItemOrItems)`
- `unnest(collectionExpr, columns, options?)` in addition to `unnest((cols) => collectionExpr, columns, options?)`
- `join(right, onExpr, mergeShape?, options?)` in addition to callback `on` and `merge`

When an existing helper receives a function, it follows the current callback path. When it receives a deferred expression, order item, or projection shape, it resolves that value against the appropriate columns and then calls the existing mutation path.

## Internal Design

Add a small deferred-expression layer to the expression core.

A deferred column ref records:

- the side it belongs to: current row, join left, or join right
- the requested column name
- enough type metadata to satisfy existing expression helper signatures

Expression helpers that currently build `ExprNode` values should build either:

- a normal `ExprRef` when all inputs are immediate values
- a deferred expression when one or more inputs are deferred

Deferred expressions are resolved at query-builder boundaries:

- `$` resolves against the current query columns.
- `$left` resolves against the left join columns.
- `$right` resolves against the right join columns.
- Nested deferred expression trees resolve recursively.
- Order items and projection shapes resolve by resolving their contained expressions.

After resolution, existing planner and renderer code should receive the same `ExprRef`, `ProjectionShape`, and `OrderItem` structures it receives today. The SQL renderer should not need to know about deferred references.

## Errors

Resolving a deferred column that does not exist should throw a user-facing error with:

- the missing column name
- the expected scope, such as current row, join left, or join right
- the available column names when known

Examples:

```ts
map(users, { missing: $.does_not_exist });
leftJoin(orders, eq($left.id, $right.missing));
```

Both should fail before SQL rendering produces an invalid query.

Using `$left` or `$right` outside a join-specific helper should also produce a clear user error.

## Type Behavior

`pickCols(...)` should be strongly typed when called in a query context:

```ts
const compact = map(users, pickCols("id", "email"));
// Query<{ id: SqlInt; email: string }>
```

Global `$` property access cannot know the current row type, so it should return a broad deferred expression type. The callback API remains the compile-time strict choice for users who want TypeScript to reject unknown columns before runtime.

The new API is additive. Existing type assertions and callback-style tests should continue to pass.

## Testing

Add tests for SQL equivalence between callback and deferred forms:

- `filter(and(eq($.active, true), gte($.age, 18)))`
- `map({ id: $.id, email: $.email })`
- `map(pickCols("id", "email"))`
- `fold({ user_id: group($.user_id), total_spend: sum($.total) })`
- `sort(asc($.email))`
- `unnest($.tags, { value: "tag" })`
- `leftJoin(orders, eq($left.id, $right.user_id))`
- join merge shape using `$left` and `$right`

Add type tests for:

- `pickCols(...)` output column inference
- object-shape `map(...)` output inference when values are deferred expressions
- callback overloads continuing to infer as before

Add error tests for:

- missing `$` column
- missing `$left` column
- missing `$right` column
- `$left` or `$right` used outside join resolution

## Migration

No migration is required. Existing callback code continues to work unchanged. Documentation should present the deferred shorthand as a compact option and explain that callbacks remain the strictest typed API.
