# Curried-Only Query Helper API

## Context

Teta query helpers currently support both data-first and curried forms:

```ts
map(users, (user) => ({ id: user.id }))
pipe(users, map((user) => ({ id: user.id })))
```

The deferred row proxy API made the curried form more ergonomic:

```ts
pipe(
  users,
  filter(eq($.active, true)),
  map({ id: $.id }),
  sort(asc($.id)),
  take(10)
)
```

Keeping both call styles now creates redundant overloads, more runtime dispatch paths, and more API surface for docs and tests. The library should prefer one query-composition style.

## Goals

- Remove data-first support for row-transforming query helpers.
- Keep only the curried query-step API for the selected helpers.
- Keep callback selectors and deferred proxy selectors inside the curried API.
- Preserve `take(...)` as the limit-stage helper.
- Do not add a new `limit(...)` alias.
- Update tests, examples, docs, and type coverage to use the curried form.
- Provide clear runtime errors for removed data-first calls when practical.

## Non-Goals

- Do not remove callback selectors such as `map((row) => ...)`.
- Do not remove deferred shorthand such as `filter(eq($.active, true))`.
- Do not add a `limit` helper.
- Do not redesign `unnest`, `union`, `unionAll`, `loop`, `values`, `table`, or render APIs in this change.
- Do not preserve hidden runtime compatibility for old data-first calls.

## Public API

The selected helpers become curried-only:

```ts
pipe(users, filter((user) => eq(user.active, true)))
pipe(users, filter(eq($.active, true)))

pipe(users, map((user) => ({ id: user.id })))
pipe(users, map({ id: $.id }))
pipe(users, map(pickCols("id", "name")))

pipe(orders, fold((order) => ({ user_id: group(order.user_id) })))
pipe(orders, fold({ user_id: group($.user_id) }))

pipe(users, sort((user) => asc(user.id)))
pipe(users, sort(asc($.id)))

pipe(users, take(10))

pipe(users, join(orders, (user, order) => eq(user.id, order.user_id)))
pipe(users, join(orders, eq($left.id, $right.user_id)))
pipe(users, leftJoin(orders, eq($left.id, $right.user_id)))
```

The following forms are removed:

```ts
map(users, selector)
filter(users, predicate)
fold(orders, selector)
sort(users, selector)
take(users, 10)
join(users, orders, on)
leftJoin(users, orders, on)
rightJoin(users, orders, on)
innerJoin(users, orders, on)
fullJoin(users, orders, on)
```

`take(...)` remains the public helper for SQL `LIMIT`; no `limit(...)` helper is introduced.

## Runtime Behavior

Each selected helper should accept only its helper-specific arguments and return a `QueryStep`.

If a removed data-first call is made at runtime, the helper should reject it with a user-facing error rather than silently interpreting it. Exact error text can be concise, for example:

```text
map() is curried-only. Use pipe(query, map(selector)).
```

The runtime error requirement applies to:

- `map(query, ...)`
- `filter(query, ...)`
- `fold(query, ...)`
- `sort(query, ...)`
- `take(query, ...)`
- `join(query, ...)`
- `innerJoin(query, ...)`
- `leftJoin(query, ...)`
- `rightJoin(query, ...)`
- `fullJoin(query, ...)`

## Internal Design

Simplify `packages/teta/src/edsl/query/builder.ts` by removing data-first overloads and `args[0] instanceof Query` dispatch branches for the selected helpers.

The private build functions can stay data-first internally:

- `buildMap(query, selector)`
- `buildFilter(query, predicate)`
- `buildFold(query, selector)`
- `buildSort(query, selector)`
- `buildTake(query, count)`
- `buildJoin(left, right, on, merge, options)`

Public helpers should return closures that call these internal builders when the query is later supplied by `pipe`.

Join parsing should no longer need to distinguish data-first join invocations from curried join invocations. It only needs to parse curried helper arguments:

```ts
join(right, on, merge?, options?)
leftJoin(right, on, merge?, options?)
```

Legacy `{ merge }` option validation should remain for the curried join API.

## Type Behavior

Remove public overloads whose first argument is a `Query` for the selected helpers.

Keep curried overloads for:

- callback selectors
- deferred expression inputs
- projection shapes
- join merge helpers and merge shapes
- join options

Type-level negative tests should assert that old data-first calls no longer typecheck.

## Migration

All in-repo call sites should migrate mechanically:

```ts
map(users, selector)
```

becomes:

```ts
pipe(users, map(selector))
```

Nested expressions should either use `pipe(...)` or assign intermediate query values. Existing Remeda `pipe` usage in docs should be the canonical style.

Examples:

```ts
const base = pipe(
  users,
  filter((user) => eq(user.active, true)),
  map((user) => ({ id: user.id }))
);
```

```ts
const joined = pipe(
  users,
  leftJoin(orders, eq($left.id, $right.user_id)),
  map({ id: $.id, total: $.total })
);
```

## Testing

Add or update type tests that old data-first forms fail:

- `map(users, selector)`
- `filter(users, predicate)`
- `fold(orders, selector)`
- `sort(users, selector)`
- `take(users, 10)`
- `join(users, orders, on)`
- fixed join data-first forms

Add runtime tests that the same removed forms throw user-facing errors when invoked through `as any`.

Update existing runtime tests, live language spec tests, examples, benchmarks, and documentation to use curried helpers.

Run the full repository check after migration.
